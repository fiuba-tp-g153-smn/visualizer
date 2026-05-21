import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { LayerControlService } from './layer-control.service';
import { LayerRenderService } from './layer-render.service';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { VectorOverlayService } from './vector-overlay.service';
import {
  EcmwfTpLayerControls,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
  GoesLayerControls,
  LayerCategory,
  LayerType,
  RadarLayerControls,
  SecondaryVectorRender,
} from '../../models';
import {
  SMN_STATION_PANE,
  SMN_STATION_PANE_Z_INDEX,
} from '../../config/layers/smn-stations/config';

/**
 * Service responsible for synchronizing and rendering satellite/radar tile layers on the map
 */
const LEAFLET_TILE_PANE = 'tilePane';
/** Leaflet pane prefix for vector overlays (isobars). */
const VECTOR_OVERLAY_PANE_PREFIX = 'data-vector-overlay-';

@Injectable({
  providedIn: 'root',
})
export class MapLayersService {
  private layersService = inject(LayersService);
  private controlService = inject(LayerControlService);
  private layerConfigService = inject(LayerConfigService);
  private layerRenderService = inject(LayerRenderService);
  private vectorOverlay = inject(VectorOverlayService);

  private map: L.Map | null = null;
  private onMapLayers = new Map<string, L.Layer>();
  private onMapOverlays = new Map<string, L.Layer>();

  /**
   * Initialize the service with a Leaflet map instance
   */
  initialize(map: L.Map): void {
    this.map = map;
    if (!map.getPane(SMN_STATION_PANE)) {
      const tilePane = map.getPane(LEAFLET_TILE_PANE);
      const pane = tilePane
        ? map.createPane(SMN_STATION_PANE, tilePane)
        : map.createPane(SMN_STATION_PANE);
      pane.style.zIndex = SMN_STATION_PANE_Z_INDEX;
      pane.style.pointerEvents = 'auto';
    }
  }

  /**
   * Synchronize layers on the map based on the provided layer IDs and their controls
   */
  syncLayers(layerIds: string[]): void {
    if (!this.map) return;

    const desiredLayersOnMap = new Map<string, L.Layer>();
    const previousSmnLayers = this.getSmnLayerEntries(this.onMapLayers);

    // Sort layers by z-index (low to high) so we process bottom layers first
    const sortedLayerIds = [...layerIds].sort((a, b) => {
      const controlsA = this.controlService.getControls(a);
      const controlsB = this.controlService.getControls(b);
      const zIndexA = this.controlService.getAbsoluteZIndex(a, controlsA);
      const zIndexB = this.controlService.getAbsoluteZIndex(b, controlsB);
      return zIndexA - zIndexB;
    });

    let zIndexOffset = 0;
    const layerActualZIndexes = new Map<string, number>();

    for (const layerId of sortedLayerIds) {
      const layer = this.layersService.getLayerById(layerId);
      if (!layer) {
        console.error(`Layer '${layerId}' not found, skipping`);
        continue;
      }

      const controls = this.controlService.getControls(layerId);
      if (!controls.visible) continue;

      // Skip tile layers that need config if config not loaded yet (will render on next sync)
      switch (layer.type) {
        case LayerType.TILE:
          switch (layer.category) {
            case LayerCategory.RADAR:
            case LayerCategory.GOES_19:
            case LayerCategory.ECMWF_TP:
              if (!this.layerConfigService.hasConfig(layerId)) {
                continue;
              }
              break;
          }
          break;
      }

      const baseZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
      const actualZIndex = baseZIndex + zIndexOffset;
      layerActualZIndexes.set(layerId, actualZIndex);

      // Render layer based on type
      switch (layer.type) {
        case LayerType.TILE:
          switch (layer.category) {
            case LayerCategory.RADAR: {
              const radarControls = controls as RadarLayerControls;
              const elevationCount = radarControls.elevation.selectedElevationIds.length;
              const layers = this.layerRenderService.createRadarLayersForPlayback(
                layerId,
                radarControls,
                controls.opacity,
                actualZIndex,
              );
              layers.forEach((layer, key) => desiredLayersOnMap.set(key, layer));

              // Add offset for multiple elevations
              if (elevationCount > 1) {
                zIndexOffset += elevationCount - 1;
              }
              break;
            }

            case LayerCategory.GOES_19: {
              const goesControls = controls as GoesLayerControls;
              const layers = this.layerRenderService.createGoesLayersForPlayback(
                layerId,
                goesControls,
                controls.opacity,
                actualZIndex,
              );
              layers.forEach((layer, key) => desiredLayersOnMap.set(key, layer));
              break;
            }

            case LayerCategory.ECMWF_TP: {
              const ecmwfControls = controls as EcmwfTpLayerControls;
              const forecastCount = ecmwfControls.forecast.selectedForecastTimestamps.length;
              const layers = this.layerRenderService.createEcmwfTpLayersForPlayback(
                layerId,
                ecmwfControls,
                controls.opacity,
                actualZIndex,
              );
              layers.forEach((layer, key) => desiredLayersOnMap.set(key, layer));

              const ecmwfLayer = layer as EcmwfTpTileLayer;
              const slotsPerForecast = ecmwfLayer.secondaryRender ? 2 : 1;
              const slotsUsed = forecastCount * slotsPerForecast;
              if (slotsUsed > 1) {
                zIndexOffset += slotsUsed - 1;
              }
              break;
            }

            default: {
              const tileLayer = this.layerRenderService.createTileLayer(layerId, controls);
              tileLayer.setOpacity(controls.opacity);
              tileLayer.setZIndex(actualZIndex);
              desiredLayersOnMap.set(layerId, tileLayer);
              break;
            }
          }
          break;

        case LayerType.VECTOR: {
          const stationLayer = this.layerRenderService.createSmnStationsLayer(
            layerId,
            controls.opacity,
            Math.round(this.map.getZoom()),
            this.map!,
            actualZIndex,
          );
          desiredLayersOnMap.set(layerId, stationLayer);
          break;
        }

        case LayerType.WMS: {
          const tileLayer = this.layerRenderService.createTileLayer(layerId, controls);
          tileLayer.setOpacity(controls.opacity);
          tileLayer.setZIndex(actualZIndex);
          desiredLayersOnMap.set(layerId, tileLayer);
          break;
        }
      }
    }

    // 1. Remove stale/replaced layers
    for (const [key, oldLayer] of this.onMapLayers) {
      const desired = desiredLayersOnMap.get(key);
      if (!desired || desired !== oldLayer) {
        this.map?.removeLayer(oldLayer);
      }
    }

    // 2. Add new or update existing layers
    for (const [key, nextLayer] of desiredLayersOnMap) {
      const oldLayer = this.onMapLayers.get(key);
      if (!oldLayer || oldLayer !== nextLayer) {
        nextLayer.addTo(this.map!);
      }
    }

    // Update local state
    this.onMapLayers = desiredLayersOnMap;

    const nextSmnLayers = this.getSmnLayerEntries(this.onMapLayers);

    if (this.shouldCloseSmnPopup(previousSmnLayers, nextSmnLayers)) {
      this.map.closePopup();
    }

    // Sync vector overlays (e.g. MSLP isobars over TP raster).
    this.syncVectorOverlays(sortedLayerIds, layerActualZIndexes);
  }

  private isSmnLayerId(layerId: string): boolean {
    const layer = this.layersService.getLayerById(layerId);
    return layer?.category === LayerCategory.SMN_STATIONS;
  }

  private getSmnLayerEntries(layers: ReadonlyMap<string, L.Layer>): Map<string, L.Layer> {
    const entries = new Map<string, L.Layer>();

    for (const [layerId, layerRef] of layers) {
      if (this.isSmnLayerId(layerId)) {
        entries.set(layerId, layerRef);
      }
    }

    return entries;
  }

  private shouldCloseSmnPopup(
    previousLayers: ReadonlyMap<string, L.Layer>,
    nextLayers: ReadonlyMap<string, L.Layer>,
  ): boolean {
    if (previousLayers.size !== nextLayers.size) {
      return true;
    }

    for (const [layerId, previousLayerRef] of previousLayers) {
      const nextLayerRef = nextLayers.get(layerId);
      if (!nextLayerRef || nextLayerRef !== previousLayerRef) {
        return true;
      }
    }

    return false;
  }

  /**
   * Synchronizes secondary vector overlays (e.g. MSLP isobars) for layers that
   * declare a `secondaryRender`. Only the *current* timestamp is rendered per
   * layer; the data fetch is deduped + cached by VectorOverlayService.
   *
   * One overlay is rendered per selected forecast — when several forecasts are
   * active on the primary TP raster, each gets its own isobar net so that the
   * vector overlay stays in lockstep with the rasters above it.
   */
  private syncVectorOverlays(
    sortedLayerIds: string[],
    layerActualZIndexes: ReadonlyMap<string, number>,
  ): void {
    if (!this.map) return;

    const desired = new Map<string, L.Layer>();

    for (const layerId of sortedLayerIds) {
      const layer = this.layersService.getLayerById(layerId);
      if (!layer || layer.type !== LayerType.TILE) continue;
      if (layer.category !== LayerCategory.ECMWF_TP) continue;

      const ecmwfLayer = layer as EcmwfTpTileLayer;
      const secondary = ecmwfLayer.secondaryRender;
      if (!secondary) continue;

      const controls = this.controlService.getControls(layerId) as EcmwfTpLayerControls;
      if (!controls.visible) continue;

      const config = this.layerConfigService.getConfig(layerId) as
        | EcmwfTpTileLayerConfig
        | undefined;
      if (!config) continue;

      const currentTimeIndex = controls.playback.timeIndex ?? 0;
      const currentEntry = config.availableTilesets[currentTimeIndex];
      if (!currentEntry) continue;
      const currentTimestampTs = currentEntry.id;

      const forecastsForCurrent = config.forecastsByPeriod[currentTimestampTs];
      if (!forecastsForCurrent) continue;

      const layerActualZIndex = layerActualZIndexes.get(layerId);
      if (layerActualZIndex === undefined) continue;

      controls.forecast.selectedForecastTimestamps.forEach((forecastTs, forecastIndex) => {
        // Only render isobars if the forecast actually has data for the
        // current timestamp (mirrors the TP raster's check).
        if (!forecastsForCurrent.includes(forecastTs)) return;

        // Match the tile renderer's opacity resolution so the isobars fade
        // in sync with their associated TP raster (per-forecast override,
        // falling back to the layer-wide opacity).
        const forecastOpacity = controls.forecast.forecastOpacity[forecastTs] ?? controls.opacity;

        const url = secondary.buildUrl(forecastTs, currentTimestampTs);
        const overlayKey = `${layerId}#${secondary.id}#${forecastTs}#${currentTimestampTs}`;
        const cached = this.vectorOverlay.peek(url);

        // Each forecast reserves 2 z-slots (TP raster + isobars). The raster
        // sits at `layerActualZIndex + forecastIndex * 2`, so the isobars
        // for that forecast slot in just above it. This places the SVG
        // above the matching TP tile but below the next layer/forecast.
        const forecastRasterZIndex = layerActualZIndex + forecastIndex * 2;
        const isobarZIndex = forecastRasterZIndex + 1;
        const paneName = `${VECTOR_OVERLAY_PANE_PREFIX}${layerId}#${secondary.id}#${forecastTs}`;
        this.ensureVectorOverlayPane(paneName, isobarZIndex);

        if (cached) {
          const overlay = this.vectorOverlay.buildLayer(
            cached,
            secondary,
            forecastOpacity,
            paneName,
          );
          desired.set(overlayKey, overlay);
        } else {
          // Cache miss: trigger an async load. The service bumps `loadTick` on
          // success, which re-runs the parent effect → re-runs syncLayers().
          void this.vectorOverlay.load(url);
        }

        // Prefetch upcoming frames for smooth animation.
        this.prefetchSecondary(secondary, config, currentTimeIndex, forecastTs);
      });
    }

    // Diff against the previously-rendered overlays.
    for (const [key, oldOverlay] of this.onMapOverlays) {
      const next = desired.get(key);
      if (!next || next !== oldOverlay) {
        this.map.removeLayer(oldOverlay);
      }
    }
    for (const [key, overlay] of desired) {
      const oldOverlay = this.onMapOverlays.get(key);
      if (!oldOverlay || oldOverlay !== overlay) {
        overlay.addTo(this.map);
      }
    }
    this.onMapOverlays = desired;
  }

  /**
   * Ensures a per-overlay pane exists as a child of `tilePane` and sets its
   * CSS z-index. Living inside `tilePane`'s stacking context lets the SVG
   * isobars compete with tile layers' internal z-indices: the pane sits just
   * above its associated TP raster but below any data layer the user pushes
   * higher in the layer order.
   */
  private ensureVectorOverlayPane(name: string, zIndex: number): void {
    if (!this.map) return;
    let pane = this.map.getPane(name);
    if (!pane) {
      const tilePane = this.map.getPane(LEAFLET_TILE_PANE);
      pane = tilePane ? this.map.createPane(name, tilePane) : this.map.createPane(name);
      pane.style.pointerEvents = 'none';
    }
    pane.style.zIndex = String(zIndex);
  }

  /** Pre-fetches the GeoJSON for the next N frames (modular wrap inside the active window). */
  private prefetchSecondary(
    secondary: SecondaryVectorRender,
    config: EcmwfTpTileLayerConfig,
    currentTimeIndex: number,
    forecastTs: string,
  ): void {
    const window = secondary.prefetchWindow ?? 0;
    if (window <= 0) return;

    const total = config.availableTilesets.length;
    if (total <= 1) return;

    const urls: string[] = [];
    for (let offset = 1; offset <= window; offset++) {
      const idx = (currentTimeIndex + offset) % total;
      const entry = config.availableTilesets[idx];
      if (!entry) continue;
      // Only prefetch frames whose forecast actually has data for that timestamp.
      const forecastsForFrame = config.forecastsByPeriod[entry.id];
      if (!forecastsForFrame || !forecastsForFrame.includes(forecastTs)) continue;
      urls.push(secondary.buildUrl(forecastTs, entry.id));
    }
    if (urls.length > 0) this.vectorOverlay.prefetch(urls);
  }

  /**
   * Clean up all layers when destroying
   */
  destroy(): void {
    this.onMapLayers.forEach((layer) => layer.remove());
    this.onMapLayers.clear();
    this.onMapOverlays.forEach((layer) => layer.remove());
    this.onMapOverlays.clear();
    this.map = null;
  }
}
