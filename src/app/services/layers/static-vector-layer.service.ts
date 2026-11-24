import { Injectable, inject } from '@angular/core';
import { GeoJSON, LatLng, Map as LeafletMap, Marker, divIcon, geoJSON, marker, svg } from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';

import { StaticVectorLayer } from '../../models';
import { ensureTilePaneChild } from '../../utils/leaflet-pane.utils';
import { VectorOverlayService } from './vector-overlay.service';

/** Leaflet pane prefix for static vector layers (one pane per layer). */
export const STATIC_VECTOR_PANE_PREFIX = 'static-vector-';

/** After a failed load, wait this long before a sync may request the file again. */
const LOAD_RETRY_COOLDOWN_MS = 30_000;

/** A text label and the zoom from which it is shown. */
interface LabelMarker {
  readonly marker: Marker;
  readonly minZoom: number;
}

interface BuiltLayer {
  readonly geoJson: GeoJSON;
  readonly labels: readonly LabelMarker[];
}

function readLabel(feature: Feature): string | null {
  const raw: unknown = feature.properties?.['label'];
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

function readMinZoom(feature: Feature): number {
  const raw: unknown = feature.properties?.['minZoom'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Point features are drawn only when they carry a label. */
function isDrawable(feature: Feature): boolean {
  const type = feature.geometry?.type;
  return (type !== 'Point' && type !== 'MultiPoint') || readLabel(feature) !== null;
}

/**
 * A non-interactive text marker in the layer's pane. The text goes in through
 * `textContent`, never as HTML, so the data file cannot inject markup.
 */
function createLabelMarker(feature: Feature, latlng: LatLng, pane: string): LabelMarker {
  const text = document.createElement('span');
  text.className = 'static-vector-label__text';
  text.textContent = readLabel(feature);
  const icon = divIcon({ className: 'static-vector-label', html: text, iconSize: [0, 0] });
  return {
    marker: marker(latlng, { icon, pane, interactive: false, keyboard: false }),
    minZoom: readMinZoom(feature),
  };
}

/**
 * Renders `StaticVectorLayer`s: a fixed FeatureCollection of lines shipped as a
 * static asset, with opacity as its only control. `Point` features with a
 * `label` property become text labels, hidden below their optional `minZoom`;
 * unlabelled points are not drawn.
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

  private readonly built = new Map<string, BuiltLayer>();
  private readonly pendingUrls = new Set<string>();
  /** url → epoch ms before which a failed load is not retried. */
  private readonly retryAfter = new Map<string, number>();

  /**
   * Places the layer's pane at `zIndex` with `opacity`, shows the labels the
   * map's zoom allows, and returns the layer to put on the map, or `null` while
   * its data is not available yet. `map-container` re-syncs on every zoom
   * change, which is what keeps the labels' visibility current.
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
    const built = this.built.get(layer.id) ?? this.buildFromCache(layer, paneName);
    if (!built) return null;
    this.applyLabelVisibility(built.labels, map.getZoom());
    return built.geoJson;
  }

  /**
   * `setOpacity` is stored on the marker, so it also holds for a label whose
   * layer is only added to the map after this call.
   */
  private applyLabelVisibility(labels: readonly LabelMarker[], zoom: number): void {
    for (const label of labels) {
      label.marker.setOpacity(zoom >= label.minZoom ? 1 : 0);
    }
  }

  private buildFromCache(layer: StaticVectorLayer, paneName: string): BuiltLayer | null {
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

  private tryBuild(
    fc: FeatureCollection,
    layer: StaticVectorLayer,
    pane: string,
  ): BuiltLayer | null {
    // One SVG renderer bound to the layer's pane, so the whole layer lands in a
    // single <svg> under that pane whatever the map's default renderer is.
    const renderer = svg({ pane });
    const labels: LabelMarker[] = [];
    try {
      const geoJson = geoJSON(fc, {
        pane,
        interactive: false,
        // Without this filter Leaflet would draw an unlabelled point as its
        // default pin, in markerPane, outside the layer's pane and opacity.
        filter: isDrawable,
        pointToLayer: (feature: Feature, latlng: LatLng) => {
          const label = createLabelMarker(feature, latlng, pane);
          labels.push(label);
          return label.marker;
        },
        style: () => ({ ...layer.style, opacity: 1, renderer }),
      });
      return { geoJson, labels };
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
