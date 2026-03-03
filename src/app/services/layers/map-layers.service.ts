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

    for (const layerId of layerIds) {
      const layer = this.layersService.getLayerById(layerId);
      if (!layer) {
        console.error(`Layer '${layerId}' not found, skipping`);
        continue;
      }

      const controls = this.controlService.getControls(layerId);
      if (!controls.visible) continue;

      const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);

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

      // Render layer based on category
      switch (layer.category) {
        case LayerCategory.RADAR: {
          const radarControls = controls as RadarLayerControls;
          const layers = this.layerRenderService.createRadarLayersForPlayback(
            layerId,
            radarControls,
            controls.opacity,
            absoluteZIndex,
          );
          layers.forEach((layer, key) => desiredLayersOnMap.set(key, layer));
          break;
        }

        case LayerCategory.GOES_19: {
          const goesControls = controls as GoesLayerControls;
          const layers = this.layerRenderService.createGoesLayersForPlayback(
            layerId,
            goesControls,
            controls.opacity,
            absoluteZIndex,
          );
          layers.forEach((layer, key) => desiredLayersOnMap.set(key, layer));
          break;
        }

        default: {
          // WMS and other non-animated layers
          const tileLayer = this.layerRenderService.createTileLayer(layerId, controls);
          tileLayer.setOpacity(controls.opacity);
          tileLayer.setZIndex(absoluteZIndex);
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
