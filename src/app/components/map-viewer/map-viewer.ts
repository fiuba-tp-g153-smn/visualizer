import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  effect,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as L from 'leaflet';
import { MAP_CONFIG } from '../../config';
import { TileService } from '../../services/tiles-providers/tile.service';
import { LayersService } from '../../services/layers/layers.service';
import { LayerControlService } from '../../services/layers/layer-control.service';
import { LayerRenderService } from '../../services/layers/layer-render.service';
import { TileProvider } from '../../models';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
})
export class MapViewer implements OnInit, OnDestroy {
  private map: L.Map | null = null;
  private platformId = inject(PLATFORM_ID);
  private tileService = inject(TileService);
  private layersService = inject(LayersService);
  private controlService = inject(LayerControlService);
  private layerRenderService = inject(LayerRenderService);

  private currentTileLayer: L.TileLayer | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Effect: cambiar mapa base
      effect(() => {
        const provider = this.tileService.currentProvider();
        if (this.map) {
          this.changeTileProvider(provider);
        }
      });

      // Effect: sincronizar capas satelitales
      effect(() => {
        const layers = this.controlService.activeLayers();
        const layerIds = layers.map((item) => item.layer.id);
        if (this.map) {
          this.syncLayers(layerIds);
        }
      });

      // Effect: sincronizar zoom cuando cambia currentZoom signal
      effect(() => {
        const targetZoom = this.currentZoom();
        if (this.map) {
          const currentMapZoom = Math.round(this.map.getZoom());
          if (currentMapZoom !== targetZoom) {
            this.map.setZoom(targetZoom);
          }
        }
      });
    }
  }

  currentZoom = signal<number>(MAP_CONFIG.initialZoom);

  canZoomIn = computed(() => {
    return this.currentZoom() < MAP_CONFIG.maxZoom;
  });

  canZoomOut = computed(() => {
    return this.currentZoom() > MAP_CONFIG.minZoom;
  });
  private ignoreNextMapEvents = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    // Limpiar capas
    this.onMapLayers.forEach((layer) => layer.remove());
    this.onMapLayers.clear();

    if (this.map) {
      this.map.remove();
    }
  }

  private async initMap(): Promise<void> {
    this.map = L.map('map', {
      center: [MAP_CONFIG.initialCenter.lat, MAP_CONFIG.initialCenter.lng],
      zoom: MAP_CONFIG.initialZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      zoomControl: false,
      fadeAnimation: false, // Desactivar fade para evitar flash en transiciones
    });

    // Update zoom signal from map events (user scrolling or programmatic changes)
    this.map.on('zoom', () => {
      if (this.ignoreNextMapEvents) {
        return;
      }
      const mapZoom = this.map?.getZoom();
      if (mapZoom !== undefined && mapZoom !== this.currentZoom()) {
        this.currentZoom.set(mapZoom);
      }
    });

    this.map.on('zoomend', () => {
      const mapZoom = this.map?.getZoom();
      const targetZoom = this.currentZoom();

      // If map reached the target, we're done
      if (mapZoom !== undefined && Math.round(mapZoom) === targetZoom) {
        this.ignoreNextMapEvents = false;
      } else if (mapZoom !== undefined && Math.round(mapZoom) !== targetZoom && this.map) {
        // Map didn't reach target - trigger another zoom
        this.ignoreNextMapEvents = false;
      }
    });

    // Initialize base tile layer
    const initialProvider = this.tileService.getCurrentProvider();
    this.changeTileProvider(initialProvider);
  }

  private changeTileProvider(provider: TileProvider): void {
    if (!this.map) return;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
      zIndex: 0,
    }).addTo(this.map);
  }

  private onMapLayers = new Map<string, L.TileLayer>();

  private syncLayers(layerIds: string[]): void {
    if (!this.map) return;

    const desiredLayersOnMap = new Map<string, L.TileLayer>();

    for (const layerId of layerIds) {
      const layer = this.layersService.getLayerById(layerId);
      const controls = this.controlService.getControls(layerId);

      if (!layer || !controls || !controls.visible) continue;

      // Special handling for radar layers with multiple elevations
      if (
        layer.type === 'tile' &&
        layer.category === 'radar' &&
        controls.type === 'tile' &&
        'elevation' in controls
      ) {
        const radarControls = controls as any; // RadarLayerControls
        const selectedElevationIds = radarControls.elevation.selectedElevationIds || [];

        // Create one layer per selected elevation
        for (const elevationId of selectedElevationIds) {
          const compositeKey = `${layerId}#${elevationId}`;
          const tileLayer = this.layerRenderService.createRadarTileLayerForElevation(
            layerId,
            radarControls,
            elevationId,
          );
          desiredLayersOnMap.set(compositeKey, tileLayer);

          // Set z-index if defined
          if (controls.zIndex !== undefined) {
            const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
            if (absoluteZIndex !== undefined) {
              tileLayer.setZIndex(absoluteZIndex);
            }
          }
        }
      } else {
        // Standard layer creation for non-radar layers
        const tileLayer = this.layerRenderService.createTileLayer(layerId, controls);
        desiredLayersOnMap.set(layerId, tileLayer);

        // Set z-index if defined (always update, even for cached layers)
        if (controls.zIndex !== undefined) {
          const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
          if (absoluteZIndex !== undefined) {
            tileLayer.setZIndex(absoluteZIndex);
          }
        }
      }
    }

    // 1. Remove layers that are no longer desired OR need to be replaced
    for (const [key, layer] of this.onMapLayers) {
      const newLayer = desiredLayersOnMap.get(key);
      // Remove if layer is gone OR if it's a different instance (e.g., placeholder -> real layer)
      if (!newLayer || newLayer !== layer) {
        this.map.removeLayer(layer);
      }
    }

    // 2. Add new layers or layers that were replaced
    for (const [key, layer] of desiredLayersOnMap) {
      const oldLayer = this.onMapLayers.get(key);
      // Add if it's a new layer OR if it's a different instance
      if (!oldLayer || oldLayer !== layer) {
        layer.addTo(this.map!);
      }
    }

    // Update local state
    this.onMapLayers = desiredLayersOnMap;
  }

  zoomIn(): void {
    if (this.map) {
      this.ignoreNextMapEvents = true;
      const newZoom = Math.min(this.currentZoom() + 1, MAP_CONFIG.maxZoom);
      this.currentZoom.set(newZoom);
    }
  }

  zoomOut(): void {
    if (this.map) {
      this.ignoreNextMapEvents = true;
      const newZoom = Math.max(this.currentZoom() - 1, MAP_CONFIG.minZoom);
      this.currentZoom.set(newZoom);
    }
  }
}
