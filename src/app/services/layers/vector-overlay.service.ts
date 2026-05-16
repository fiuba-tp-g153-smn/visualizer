import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';

import { SecondaryVectorRender } from '../../models';
import { isTextPathLayer } from '../../utils/textpath-layer';

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
   */
  buildLayer(fc: FeatureCollection, config: SecondaryVectorRender): L.GeoJSON {
    // `leaflet-textpath` manipula el DOM SVG (<textPath>) — si el mapa global usa
    // canvas, hay que forzar el renderer SVG por feature en el style callback.
    const renderer = L.svg();
    return L.geoJSON(fc, {
      style: (feature?: Feature) => {
        const value = this.readValue(feature, config.valueProperty);
        if (value === null) return { renderer };
        return { ...styleToLeaflet(config.styleFor(value)), renderer };
      },
      onEachFeature: (feature: Feature, layer: L.Layer) => {
        const value = this.readValue(feature, config.valueProperty);
        if (value === null) return;
        const label = config.labelFor(value);
        if (label && isTextPathLayer(layer)) {
          layer.setText(label, config.textpathOptions);
        }
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
