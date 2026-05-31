import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { LayerControlService } from './layer-control.service';
import { LayerRenderService } from './layer-render.service';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { VectorOverlayService } from './vector-overlay.service';
import { WrfBarbGridLayer } from './wrf-barb-grid-layer';
import {
  BarbTileRender,
  EcmwfTpLayerControls,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
  GoesLayerControls,
  LayerCategory,
  LayerType,
  RadarLayerControls,
  SecondaryVectorRender,
  WrfLayerControls,
  WrfTileLayer,
  WrfTileLayerConfig,
} from '../../models';
import {
  WEATHER_STATION_PANE,
  WEATHER_STATION_PANE_Z_INDEX,
} from '../../config/layers/weather-stations/config';

/**
 * Service responsible for synchronizing and rendering satellite/radar tile layers on the map
 */
const LEAFLET_TILE_PANE = 'tilePane';
/** Leaflet pane prefix for vector overlays (isobars). */
const VECTOR_OVERLAY_PANE_PREFIX = 'data-vector-overlay-';

/** Bounds aproximados del dominio WRF (Argentina + alrededores). Evita pedir
 *  tiles fuera del dominio Lambert cuando el viewport está en otra región. */
const WRF_BARB_BOUNDS = L.latLngBounds(
  L.latLng(-60.0, -110.0),
  L.latLng(-15.0, -30.0),
);

function isBarbTileRender(
  render: SecondaryVectorRender | BarbTileRender,
): render is BarbTileRender {
  return 'kind' in render && render.kind === 'barb-tile';
}

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
  /** Cache de GridLayers vectoriales de barbas, ruteada por `layerId#productId#fxxx`. */
  private barbTileLayers = new Map<string, L.GridLayer>();

  /**
   * Initialize the service with a Leaflet map instance
   */
  initialize(map: L.Map): void {
    this.map = map;
    if (!map.getPane(WEATHER_STATION_PANE)) {
      const tilePane = map.getPane(LEAFLET_TILE_PANE);
      const pane = tilePane
        ? map.createPane(WEATHER_STATION_PANE, tilePane)
        : map.createPane(WEATHER_STATION_PANE);
      pane.style.zIndex = WEATHER_STATION_PANE_Z_INDEX;
      pane.style.pointerEvents = 'auto';
    }
  }

  /**
   * Synchronize layers on the map based on the provided layer IDs and their controls
   */
  syncLayers(layerIds: string[]): void {
    if (!this.map) return;

    const desiredLayersOnMap = new Map<string, L.Layer>();
    const previousWeatherStationLayers = this.getWeatherStationLayerEntries(this.onMapLayers);

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
            case LayerCategory.WRF:
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

            case LayerCategory.WRF: {
              const wrfControls = controls as WrfLayerControls;
              const forecastCount = wrfControls.forecast.selectedForecastTimestamps.length;
              const layers = this.layerRenderService.createWrfLayersForPlayback(
                layerId,
                wrfControls,
                controls.opacity,
                actualZIndex,
              );
              layers.forEach((layer, key) => desiredLayersOnMap.set(key, layer));
              if (forecastCount > 1) {
                zIndexOffset += forecastCount - 1;
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
          const stationLayer = this.layerRenderService.createWeatherStationsLayer(
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

    const nextWeatherStationLayers = this.getWeatherStationLayerEntries(this.onMapLayers);

    if (this.shouldCloseWeatherStationPopup(previousWeatherStationLayers, nextWeatherStationLayers)) {
      this.map.closePopup();
    }

    // Sync vector overlays (e.g. MSLP isobars over TP raster).
    this.syncVectorOverlays(sortedLayerIds, layerActualZIndexes);
  }

  private isWeatherStationLayerId(layerId: string): boolean {
    const layer = this.layersService.getLayerById(layerId);
    return layer?.category === LayerCategory.WEATHER_STATIONS;
  }

  private getWeatherStationLayerEntries(layers: ReadonlyMap<string, L.Layer>): Map<string, L.Layer> {
    const entries = new Map<string, L.Layer>();

    for (const [layerId, layerRef] of layers) {
      if (this.isWeatherStationLayerId(layerId)) {
        entries.set(layerId, layerRef);
      }
    }

    return entries;
  }

  private shouldCloseWeatherStationPopup(
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

      if (layer.category === LayerCategory.ECMWF_TP) {
        this.collectEcmwfOverlays(
          layerId,
          layer as EcmwfTpTileLayer,
          layerActualZIndexes,
          desired,
        );
      } else if (layer.category === LayerCategory.WRF) {
        this.collectWrfOverlays(layerId, layer as WrfTileLayer, layerActualZIndexes, desired);
      }
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

    // Garbage-collect cached barb tile layers no longer present in `desired`.
    for (const key of this.barbTileLayers.keys()) {
      if (!desired.has(key)) this.barbTileLayers.delete(key);
    }
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

  /**
   * Collects ECMWF isobar overlays. One overlay is rendered per selected
   * forecast — each forecast reserves 2 z-slots (TP raster + isobars), so the
   * isobars slot in just above their matching raster and fade in lockstep with
   * it.
   */
  private collectEcmwfOverlays(
    layerId: string,
    ecmwfLayer: EcmwfTpTileLayer,
    layerActualZIndexes: ReadonlyMap<string, number>,
    desired: Map<string, L.Layer>,
  ): void {
    const secondary = ecmwfLayer.secondaryRender;
    if (!secondary) return;

    const controls = this.controlService.getControls(layerId) as EcmwfTpLayerControls;
    if (!controls.visible) return;

    const config = this.layerConfigService.getConfig(layerId) as
      | EcmwfTpTileLayerConfig
      | undefined;
    if (!config) return;

    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const currentEntry = config.availableTilesets[currentTimeIndex];
    if (!currentEntry) return;
    const currentTimestampTs = currentEntry.id;

    const forecastsForCurrent = config.forecastsByPeriod[currentTimestampTs];
    if (!forecastsForCurrent) return;

    const layerActualZIndex = layerActualZIndexes.get(layerId);
    if (layerActualZIndex === undefined) return;

    controls.forecast.selectedForecastTimestamps.forEach((forecastTs, forecastIndex) => {
      // Only render isobars if the forecast actually has data for the
      // current timestamp (mirrors the TP raster's check).
      if (!forecastsForCurrent.includes(forecastTs)) return;

      // Match the tile renderer's opacity resolution so the isobars fade in
      // sync with their associated TP raster (per-forecast override, falling
      // back to the layer-wide opacity).
      const forecastOpacity = controls.forecast.forecastOpacity[forecastTs] ?? controls.opacity;

      // Each forecast reserves 2 z-slots (TP raster + isobars). The raster sits
      // at `layerActualZIndex + forecastIndex * 2`, so the isobars for that
      // forecast slot in just above it.
      const isobarZIndex = layerActualZIndex + forecastIndex * 2 + 1;

      this.requestOverlay(
        layerId,
        secondary,
        forecastTs,
        currentTimestampTs,
        forecastOpacity,
        isobarZIndex,
        desired,
      );
      // Prefetch upcoming frames for smooth animation.
      this.prefetchSecondary(secondary, config, currentTimeIndex, forecastTs);
    });
  }

  /**
   * WRF mirrors the ECMWF flow but iterates `secondaryRenders[]` (multiple
   * overlays per product: barbs + contornos + slp) and renders one set per
   * selected forecast. WRF reserves a single z-slot per forecast (raster), so
   * every overlay for that forecast stacks just above it.
   */
  private collectWrfOverlays(
    layerId: string,
    wrfLayer: WrfTileLayer,
    layerActualZIndexes: ReadonlyMap<string, number>,
    desired: Map<string, L.Layer>,
  ): void {
    const renders = wrfLayer.secondaryRenders;
    if (!renders || renders.length === 0) return;

    const controls = this.controlService.getControls(layerId) as WrfLayerControls;
    if (!controls.visible) return;

    const config = this.layerConfigService.getConfig(layerId) as
      | WrfTileLayerConfig
      | undefined;
    if (!config) return;

    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const currentEntry = config.availableTilesets[currentTimeIndex];
    if (!currentEntry) return;
    const currentTimestampTs = currentEntry.id;

    const forecastsForCurrent = config.forecastsByPeriod[currentTimestampTs];
    if (!forecastsForCurrent) return;

    const layerActualZIndex = layerActualZIndexes.get(layerId);
    if (layerActualZIndex === undefined) return;

    controls.forecast.selectedForecastTimestamps.forEach((forecastTs, forecastIndex) => {
      // Only render overlays if the forecast actually has data for the current
      // timestamp (mirrors the raster's check).
      if (!forecastsForCurrent.includes(forecastTs)) return;

      // Per-forecast opacity override, falling back to the layer-wide opacity.
      const forecastOpacity = controls.forecast.forecastOpacity[forecastTs] ?? controls.opacity;

      // WRF reserves 1 z-slot per forecast (raster); its overlays stack just
      // above that raster.
      const overlayZIndex = layerActualZIndex + forecastIndex + 1;

      for (const render of renders) {
        // Barb (wind) fields ship as their own tiled GridLayer (arrows drawn
        // per tile) rather than a single GeoJSON overlay, so they take a
        // dedicated path.
        if (isBarbTileRender(render)) {
          this.requestBarbTile(
            layerId,
            wrfLayer.productId,
            render,
            forecastTs,
            currentTimestampTs,
            overlayZIndex,
            desired,
          );
          continue;
        }
        this.requestOverlay(
          layerId,
          render,
          forecastTs,
          currentTimestampTs,
          forecastOpacity,
          overlayZIndex,
          desired,
        );
        this.prefetchSecondary(render, config, currentTimeIndex, forecastTs);
      }
    });
  }

  /**
   * Renders a WRF barb (wind) field as a tiled `WrfBarbGridLayer`, cached per
   * `(layer, render, init, step)` and placed in the same per-forecast pane /
   * z-index as the other overlays for that forecast.
   */
  private requestBarbTile(
    layerId: string,
    productId: string,
    render: BarbTileRender,
    initTag: string,
    fxxx: string,
    zIndex: number,
    desired: Map<string, L.Layer>,
  ): void {
    const cacheKey = `${layerId}#${render.id}#${initTag}#${fxxx}`;
    const paneName = `${VECTOR_OVERLAY_PANE_PREFIX}${layerId}#${render.id}#${initTag}`;
    this.ensureVectorOverlayPane(paneName, zIndex);

    let tile = this.barbTileLayers.get(cacheKey);
    if (!tile) {
      tile = new WrfBarbGridLayer({
        productId,
        initTag,
        fxxx,
        bounds: WRF_BARB_BOUNDS,
        pane: paneName,
      });
      this.barbTileLayers.set(cacheKey, tile);
    }
    desired.set(cacheKey, tile);
  }

  /**
   * Builds (or schedules the async load of) a single vector overlay for one
   * `(render, forecast)` pair, placing it in a dedicated per-forecast pane at
   * the given z-index so it stacks and fades in lockstep with its raster.
   */
  private requestOverlay(
    layerId: string,
    render: SecondaryVectorRender,
    forecastTs: string,
    timestampTs: string,
    opacity: number,
    zIndex: number,
    desired: Map<string, L.Layer>,
  ): void {
    const url = render.buildUrl(forecastTs, timestampTs);
    const overlayKey = `${layerId}#${render.id}#${forecastTs}#${timestampTs}`;
    const cached = this.vectorOverlay.peek(url);

    const paneName = `${VECTOR_OVERLAY_PANE_PREFIX}${layerId}#${render.id}#${forecastTs}`;
    this.ensureVectorOverlayPane(paneName, zIndex);

    if (cached) {
      const overlay = this.vectorOverlay.buildLayer(cached, render, opacity, paneName);
      desired.set(overlayKey, overlay);
    } else {
      // Cache miss: trigger an async load. The service bumps `loadTick` on
      // success, which re-runs the parent effect → re-runs syncLayers().
      void this.vectorOverlay.load(url);
    }
  }

  /** Pre-fetches the GeoJSON for the next N frames (modular wrap inside the active window). */
  private prefetchSecondary(
    secondary: SecondaryVectorRender,
    config: EcmwfTpTileLayerConfig | WrfTileLayerConfig,
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
    this.barbTileLayers.clear();
    this.map = null;
  }
}
