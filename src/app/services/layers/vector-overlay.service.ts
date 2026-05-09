import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';

import { SecondaryVectorRender } from '../../models';

const DEFAULT_MAX_CACHE_ENTRIES = 50;
const DEFAULT_FETCH_CONCURRENCY = 3;

/**
 * Cache + fetch + prefetch + Leaflet builder para overlays vectoriales (e.g.
 * isobaras MSLP). El servicio NO conoce nada del lifecycle de Layer/Map; solo
 * entrega `FeatureCollection` por URL y construye un `L.GeoJSON` configurado
 * según un `SecondaryVectorRender`.
 *
 * Características:
 * - Cache LRU acotado (default 50 entradas).
 * - Deduplicación de in-flight: dos `load()` concurrentes para la misma URL
 *   comparten una sola request.
 * - Concurrencia acotada: a lo sumo N fetches en paralelo (default 3).
 * - Errores de fetch resuelven a `null` (render silencioso, animación sigue).
 */
@Injectable({
  providedIn: 'root',
})
export class VectorOverlayService {
  private readonly http = inject(HttpClient);

  /** LRU: orden de inserción = orden de uso. */
  private readonly cache = new Map<string, FeatureCollection>();
  private readonly inflight = new Map<string, Promise<FeatureCollection | null>>();

  private readonly maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES;
  private readonly maxConcurrency = DEFAULT_FETCH_CONCURRENCY;
  private activeFetches = 0;
  private readonly waiters: Array<() => void> = [];

  /**
   * Tick que incrementa cada vez que un fetch puebla el cache. Permite que
   * efectos reactivos (e.g. MapLayersService) re-corran su sincronización
   * cuando llega data nueva sin necesidad de polling.
   */
  private readonly loadTickSignal = signal(0);
  readonly loadTick = this.loadTickSignal.asReadonly();

  /**
   * Devuelve el FeatureCollection cacheado o lo descarga.
   * Resuelve a `null` si la descarga falla (404, red, etc.) — render silencioso.
   */
  async load(url: string): Promise<FeatureCollection | null> {
    const cached = this.cache.get(url);
    if (cached) {
      this.touch(url);
      return cached;
    }

    const inflight = this.inflight.get(url);
    if (inflight) return inflight;

    const promise = this.fetchWithSemaphore(url);
    this.inflight.set(url, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(url);
    }
  }

  /**
   * Lectura sincrónica del cache. Devuelve `null` en miss.
   * Útil para el render path cuando se quiere evitar una promesa.
   */
  peek(url: string): FeatureCollection | null {
    return this.cache.get(url) ?? null;
  }

  /**
   * Pre-carga una lista de URLs sin bloquear. Las URLs ya cacheadas o en vuelo
   * se omiten. Errores son ignorados silenciosamente.
   */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) {
      if (this.cache.has(url) || this.inflight.has(url)) continue;
      void this.load(url);
    }
  }

  /**
   * Construye un `L.GeoJSON` con el estilo y las etiquetas declaradas en el
   * config. Para que las etiquetas funcionen el plugin `leaflet-textpath` debe
   * estar importado (ver main.ts).
   *
   * Soporta tanto Lines/Polygons (style + setText) como Points (cuando el
   * config trae `pointToLayer`, e.g. barbas WRF). Leaflet sólo invoca
   * `pointToLayer` para features Point y `style` / `onEachFeature` para
   * non-Point, así que ambos pueden coexistir sin checks adicionales.
   */
  buildLayer(fc: FeatureCollection, config: SecondaryVectorRender): L.GeoJSON {
    // `leaflet-textpath` manipula el DOM SVG (<textPath>) — si el mapa global usa
    // canvas, hay que forzar el renderer SVG por feature en el style callback.
    const renderer = L.svg();
    return L.geoJSON(fc, {
      pointToLayer: config.pointToLayer
        ? (feature, latlng) => config.pointToLayer!(feature, latlng)
        : undefined,
      style: (feature?: Feature) => {
        const value = this.readValue(feature, config.valueProperty);
        if (value === null) return { renderer };
        return { ...styleToLeaflet(config.styleFor(value)), renderer };
      },
      onEachFeature: (feature: Feature, layer: L.Layer) => {
        const value = this.readValue(feature, config.valueProperty);
        if (value === null) return;
        const label = config.labelFor(value);
        if (!(label && layer instanceof L.Polyline)) return;
        // SVG `<textPath>` sigue la dirección del path. Si el tramo va de
        // derecha a izquierda el texto sale invertido. Reorientarlo evita
        // tener que recurrir a `orientation: 'flip'` (que en este plugin
        // rota el `<text>` entero alrededor del bbox y despega los glifos
        // de la curva).
        ensureLeftToRight(layer);
        layer.setText(label, config.textpathOptions);
      },
    });
  }

  /** Limpia el cache. Útil al cambiar de capa o al reiniciar. */
  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  private readValue(feature: Feature | undefined, key: string): number | null {
    const raw = feature?.properties?.[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }

  private touch(url: string): void {
    const fc = this.cache.get(url);
    if (!fc) return;
    this.cache.delete(url);
    this.cache.set(url, fc);
  }

  private put(url: string, fc: FeatureCollection): void {
    this.cache.set(url, fc);
    while (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private async fetchWithSemaphore(url: string): Promise<FeatureCollection | null> {
    await this.acquire();
    try {
      const fc = await firstValueFrom(this.http.get<FeatureCollection>(url));
      this.put(url, fc);
      this.loadTickSignal.update((v) => v + 1);
      return fc;
    } catch (err) {
      console.warn('[VectorOverlay] fetch failed', url, err);
      return null;
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.activeFetches < this.maxConcurrency) {
      this.activeFetches += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.activeFetches += 1;
  }

  private release(): void {
    this.activeFetches -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

/**
 * Garantiza que la polyline esté orientada izquierda→derecha (longitud
 * creciente del primer al último vértice). Si el tramo va al revés invierte
 * los latlngs in-place vía `setLatLngs`. Para `MultiLineString` aplica la
 * heurística por anillo, ya que cada sub-tramo tiene su propio `<textPath>`.
 *
 * Comparar solo extremos es barato y suficiente: nos importa la dirección
 * global del path para decidir si el texto saldría de cabeza, no la
 * monotonía local.
 */
function ensureLeftToRight(layer: L.Polyline): void {
  const latlngs = layer.getLatLngs() as L.LatLng[] | L.LatLng[][];
  if (latlngs.length === 0) return;

  if (latlngs[0] instanceof L.LatLng) {
    const arr = latlngs as L.LatLng[];
    if (arr.length >= 2 && arr[arr.length - 1].lng < arr[0].lng) {
      layer.setLatLngs([...arr].reverse());
    }
    return;
  }

  const rings = latlngs as L.LatLng[][];
  let mutated = false;
  const fixed = rings.map((ring) => {
    if (ring.length >= 2 && ring[ring.length - 1].lng < ring[0].lng) {
      mutated = true;
      return [...ring].reverse();
    }
    return ring;
  });
  if (mutated) layer.setLatLngs(fixed);
}

/**
 * Convierte un `VectorLineStyle` plano a `L.PathOptions`.
 */
function styleToLeaflet(style: {
  color: string;
  weight: number;
  dashArray?: string;
  opacity?: number;
}): L.PathOptions {
  return {
    color: style.color,
    weight: style.weight,
    dashArray: style.dashArray,
    opacity: style.opacity ?? 1,
    fill: false,
  };
}
