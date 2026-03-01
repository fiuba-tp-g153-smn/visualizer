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
import { TilePrefetchService } from '../../services/layers/tile-prefetch.service';
import { TileProvider, LayerCategory, GoesLayerControls, RadarLayerControls } from '../../models';

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
  private prefetchService = inject(TilePrefetchService);

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

      if (mapZoom !== undefined) {
        this.prefetchService.setZoom(Math.round(mapZoom));
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

    const desiredLayersOnMap = new Map<string, { tileLayer: L.TileLayer; targetOpacity: number }>();

    for (const layerId of layerIds) {
      const layer = this.layersService.getLayerById(layerId);
      const controls = this.controlService.getControls(layerId);

      if (!layer || !controls || !controls.visible) continue;

      const absoluteZIndex =
        controls.zIndex !== undefined
          ? this.controlService.getAbsoluteZIndex(layerId, controls)
          : undefined;

      switch (layer.category) {
        case LayerCategory.RADAR: {
          const radarControls = controls as RadarLayerControls;
          const layers = this.layerRenderService.createRadarLayersForPlayback(
            layerId,
            radarControls,
            controls.opacity,
            absoluteZIndex,
          );
          layers.forEach((value, key) => desiredLayersOnMap.set(key, value));
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
          layers.forEach((value, key) => desiredLayersOnMap.set(key, value));
          break;
        }

        default: {
          // WMS and other non-animated layers
          const tileLayer = this.layerRenderService.createTileLayer(layerId, controls);
          desiredLayersOnMap.set(layerId, { tileLayer, targetOpacity: controls.opacity });

          if (absoluteZIndex !== undefined) {
            tileLayer.setZIndex(absoluteZIndex);
          }
          break;
        }
      }
    }

    // 1. Remove stale/replaced layers
    for (const [key, oldLayer] of this.onMapLayers) {
      const desired = desiredLayersOnMap.get(key);
      if (!desired || desired.tileLayer !== oldLayer) {
        this.map?.removeLayer(oldLayer);
      }
    }

    // 2. Add new or update existing layers
    for (const [key, { tileLayer, targetOpacity }] of desiredLayersOnMap) {
      const oldLayer = this.onMapLayers.get(key);
      tileLayer.setOpacity(targetOpacity);
      if (!oldLayer || oldLayer !== tileLayer) {
        tileLayer.addTo(this.map!);
      }
    }

    // Update local state
    this.onMapLayers = new Map(
      [...desiredLayersOnMap.entries()].map(([key, { tileLayer }]) => [key, tileLayer]),
    );
  }

  zoomIn(): void {
    if (this.map) {
      this.ignoreNextMapEvents = true;
      const newZoom = Math.min(this.currentZoom() + 1, MAP_CONFIG.maxZoom);
      this.currentZoom.set(newZoom);
      this.prefetchService.setZoom(newZoom);
    }
  }

  zoomOut(): void {
    if (this.map) {
      this.ignoreNextMapEvents = true;
      const newZoom = Math.max(this.currentZoom() - 1, MAP_CONFIG.minZoom);
      this.currentZoom.set(newZoom);
      this.prefetchService.setZoom(newZoom);
    }
  }
}
