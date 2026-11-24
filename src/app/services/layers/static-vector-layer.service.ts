import { Injectable, inject } from '@angular/core';
import { GeoJSON, Map as LeafletMap, geoJSON, svg } from 'leaflet';
import type { FeatureCollection } from 'geojson';

import { StaticVectorLayer } from '../../models';
import { ensureTilePaneChild } from '../../utils/leaflet-pane.utils';
import { VectorOverlayService } from './vector-overlay.service';

/** Leaflet pane prefix for static vector layers (one pane per layer). */
export const STATIC_VECTOR_PANE_PREFIX = 'static-vector-';

/** After a failed load, wait this long before a sync may request the file again. */
const LOAD_RETRY_COOLDOWN_MS = 30_000;

/**
 * Renders `StaticVectorLayer`s: a fixed FeatureCollection of lines shipped as a
 * static asset, with opacity as its only control.
 *
 * - **Opacity goes on the pane, not on each path.** Each layer gets its own
 *   pane, so the SVG composites opaque and is faded as a whole: segments shared
 *   by neighbouring features (e.g. two zones' common boundary) are drawn twice
 *   but never look darker than the rest. An opacity change also never rebuilds
 *   the layer.
 * - **One `L.GeoJSON` instance per layer, built once.** `MapLayersService`
 *   removes any layer whose instance changed between syncs, so a rebuild would
 *   flicker. Holding the instance also means the file is fetched once per
 *   session, even if `VectorOverlayService`'s LRU (shared with the isobar
 *   animation) later evicts it.
 * - **Fetching goes through `VectorOverlayService`**, which dedupes in-flight
 *   requests and bumps `loadTick` on success; `map-container` tracks that tick,
 *   so the next sync picks the layer up without polling.
 */
@Injectable({
  providedIn: 'root',
})
export class StaticVectorLayerService {
  private readonly vectorOverlay = inject(VectorOverlayService);

  private readonly built = new Map<string, GeoJSON>();
  private readonly pendingUrls = new Set<string>();
  /** url → epoch ms before which a failed load is not retried. */
  private readonly retryAfter = new Map<string, number>();

  /**
   * Places the layer's pane at `zIndex` with `opacity` and returns the layer to
   * put on the map, or `null` while its data is not available yet.
   */
  render(
    layer: StaticVectorLayer,
    map: LeafletMap,
    opacity: number,
    zIndex: number,
  ): GeoJSON | null {
    const paneName = `${STATIC_VECTOR_PANE_PREFIX}${layer.id}`;
    const pane = ensureTilePaneChild(map, paneName, zIndex);
    pane.style.opacity = String(opacity);
    return this.built.get(layer.id) ?? this.buildFromCache(layer, paneName);
  }

  private buildFromCache(layer: StaticVectorLayer, paneName: string): GeoJSON | null {
    if (this.isCoolingDown(layer.dataUrl)) return null;
    const fc = this.vectorOverlay.peek(layer.dataUrl);
    if (!fc) {
      this.requestLoad(layer.dataUrl);
      return null;
    }
    const built = this.tryBuild(fc, layer, paneName);
    if (built) this.built.set(layer.id, built);
    return built;
  }

  private tryBuild(fc: FeatureCollection, layer: StaticVectorLayer, pane: string): GeoJSON | null {
    // One SVG renderer bound to the layer's pane, so the whole layer lands in a
    // single <svg> under that pane whatever the map's default renderer is.
    const renderer = svg({ pane });
    try {
      return geoJSON(fc, {
        pane,
        interactive: false,
        style: () => ({ ...layer.style, opacity: 1, renderer }),
      });
    } catch (error: unknown) {
      // A malformed document must not throw out of the sync loop, which would
      // stop every other layer from rendering. Treat it like a failed load.
      this.markFailed(layer.dataUrl, error);
      return null;
    }
  }

  private requestLoad(url: string): void {
    if (this.pendingUrls.has(url)) return;
    this.pendingUrls.add(url);
    void this.vectorOverlay.load(url).then((fc) => {
      this.pendingUrls.delete(url);
      if (fc) {
        this.retryAfter.delete(url);
        return;
      }
      this.markFailed(url);
    });
  }

  private isCoolingDown(url: string): boolean {
    const retryAt = this.retryAfter.get(url);
    return retryAt !== undefined && Date.now() < retryAt;
  }

  private markFailed(url: string, cause?: unknown): void {
    this.retryAfter.set(url, Date.now() + LOAD_RETRY_COOLDOWN_MS);
    console.warn(`Static vector layer data could not be loaded: ${url}`, cause ?? '');
  }
}
