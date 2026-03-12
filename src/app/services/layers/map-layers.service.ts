import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { LayerControlService } from './layer-control.service';
import { LayerRenderService } from './layer-render.service';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { GoesLayerControls, LayerCategory, LayerType, RadarLayerControls } from '../../models';

/**
 * Service responsible for synchronizing and rendering satellite/radar tile layers on the map
 */
@Injectable({
  providedIn: 'root',
})
export class MapLayersService {
  private layersService = inject(LayersService);
  private controlService = inject(LayerControlService);
  private layerConfigService = inject(LayerConfigService);
  private layerRenderService = inject(LayerRenderService);

  private map: L.Map | null = null;
  private onMapLayers = new Map<string, L.TileLayer>();

  /**
   * Initialize the service with a Leaflet map instance
   */
  initialize(map: L.Map): void {
    this.map = map;
  }

  /**
   * Synchronize layers on the map based on the provided layer IDs and their controls
   */
  syncLayers(layerIds: string[]): void {
    if (!this.map) return;

    const desiredLayersOnMap = new Map<string, L.TileLayer>();

    // Sort layers by z-index (low to high) so we process bottom layers first
    const sortedLayerIds = [...layerIds].sort((a, b) => {
      const controlsA = this.controlService.getControls(a);
      const controlsB = this.controlService.getControls(b);
      const zIndexA = this.controlService.getAbsoluteZIndex(a, controlsA);
      const zIndexB = this.controlService.getAbsoluteZIndex(b, controlsB);
      return zIndexA - zIndexB;
    });

    let zIndexOffset = 0;

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
              if (!this.layerConfigService.hasConfig(layerId)) {
                continue;
              }
              break;
          }
          break;
      }

      const baseZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
      const actualZIndex = baseZIndex + zIndexOffset;

      // Render layer based on category
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

        default: {
          // WMS and other non-animated layers
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
    for (const [key, tileLayer] of desiredLayersOnMap) {
      const oldLayer = this.onMapLayers.get(key);
      if (!oldLayer || oldLayer !== tileLayer) {
        tileLayer.addTo(this.map!);
      }
    }

    // Update local state
    this.onMapLayers = desiredLayersOnMap;
  }

  /**
   * Clean up all layers when destroying
   */
  destroy(): void {
    this.onMapLayers.forEach((layer) => layer.remove());
    this.onMapLayers.clear();
    this.map = null;
  }
}
