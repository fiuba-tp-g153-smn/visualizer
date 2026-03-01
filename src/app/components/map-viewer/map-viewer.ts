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
import { TileProvider, LayerType, LayerCategory, GoesLayerControls } from '../../models';

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

  private static readonly DOM_PREFETCH_RADIUS = 2;

  private onMapLayers = new Map<string, L.TileLayer>();

  private syncLayers(layerIds: string[]): void {
    if (!this.map) return;

    const desiredLayersOnMap = new Map<string, { tileLayer: L.TileLayer; targetOpacity: number }>();

    for (const layerId of layerIds) {
      const layer = this.layersService.getLayerById(layerId);
      const controls = this.controlService.getControls(layerId);

      if (!layer || !controls || !controls.visible) continue;

      const targetOpacity = (controls.opacity ?? 100) / 100;

      if (
        layer.type === LayerType.TILE &&
        layer.category === LayerCategory.RADAR &&
        controls.type === LayerType.TILE &&
        'elevation' in controls
      ) {
        // Radar: one layer per selected elevation, keyed by layerId#elevationId#timeIndex
        const radarControls = controls as any;
        const selectedElevationIds = radarControls.elevation.selectedElevationIds || [];
        const currentTimeIndex = radarControls.playback.timeIndex ?? 0;
        const totalFrames = this.layerRenderService.getAvailableTilesetsCount(layerId);

        for (const elevationId of selectedElevationIds) {
          const compositeKey = `${layerId}#${elevationId}#${currentTimeIndex}`;
          const tileLayer = this.layerRenderService.createRadarTileLayerForElevation(
            layerId,
            radarControls,
            elevationId,
          );
          desiredLayersOnMap.set(compositeKey, { tileLayer, targetOpacity });

          if (controls.zIndex !== undefined) {
            const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
            if (absoluteZIndex !== undefined) tileLayer.setZIndex(absoluteZIndex);
          }

          // Pre-fetch T±DOM_PREFETCH_RADIUS: keep adjacent radar frames on map at opacity=0
          // Uses modular wrap-around within the playback window to also pre-render frame 0
          // when at the last frame, preventing a flash on loop.
          const radarLastImagesCount = radarControls.playback.lastImagesCount;
          const radarMinTimeIndex = Math.max(0, totalFrames - radarLastImagesCount);
          const radarWindowSize = totalFrames - radarMinTimeIndex;
          if (radarWindowSize > 1) {
            for (let offset = -MapViewer.DOM_PREFETCH_RADIUS; offset <= MapViewer.DOM_PREFETCH_RADIUS; offset++) {
              if (offset === 0) continue;
              const posInWindow = currentTimeIndex - radarMinTimeIndex;
              const adjPosInWindow = ((posInWindow + offset) % radarWindowSize + radarWindowSize) % radarWindowSize;
              const adjIndex = radarMinTimeIndex + adjPosInWindow;
              const adjLayer = this.layerRenderService.createRadarTileLayerForElevationAtTimeIndex(
                layerId,
                radarControls,
                elevationId,
                adjIndex,
              );
              desiredLayersOnMap.set(`${layerId}#${elevationId}#${adjIndex}`, {
                tileLayer: adjLayer,
                targetOpacity: 0,
              });
            }
          }
        }
      } else if (
        layer.type === LayerType.TILE &&
        layer.category === LayerCategory.GOES_19 &&
        controls.type === LayerType.TILE
      ) {
        // GOES: use stable keys per timeIndex so pre-fetched adjacent frames can transition
        // smoothly without reloading tiles (no flash).
        const goesControls = controls as GoesLayerControls;
        const currentTimeIndex = goesControls.playback.timeIndex ?? 0;
        const totalFrames = this.layerRenderService.getAvailableTilesetsCount(layerId);

        // Current frame
        const tileLayer = this.layerRenderService.createTileLayer(layerId, goesControls);
        const mainKey = `${layerId}#${currentTimeIndex}`;
        desiredLayersOnMap.set(mainKey, { tileLayer, targetOpacity });

        if (controls.zIndex !== undefined) {
          const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
          if (absoluteZIndex !== undefined) tileLayer.setZIndex(absoluteZIndex);
        }

        // Pre-fetch T±DOM_PREFETCH_RADIUS: keep adjacent frames on map at opacity=0 so tiles are ready when needed
        // Uses modular wrap-around within the playback window to also pre-render frame 0
        // when at the last frame, preventing a flash on loop.
        const goesLastImagesCount = goesControls.playback.lastImagesCount;
        const goesMinTimeIndex = Math.max(0, totalFrames - goesLastImagesCount);
        const goesWindowSize = totalFrames - goesMinTimeIndex;
        if (goesWindowSize > 1) {
          for (let offset = -MapViewer.DOM_PREFETCH_RADIUS; offset <= MapViewer.DOM_PREFETCH_RADIUS; offset++) {
            if (offset === 0) continue;
            const posInWindow = currentTimeIndex - goesMinTimeIndex;
            const adjPosInWindow = ((posInWindow + offset) % goesWindowSize + goesWindowSize) % goesWindowSize;
            const adjIndex = goesMinTimeIndex + adjPosInWindow;
            const adjLayer = this.layerRenderService.createTileLayerForTimeIndex(layerId, goesControls, adjIndex);
            desiredLayersOnMap.set(`${layerId}#${adjIndex}`, { tileLayer: adjLayer, targetOpacity: 0 });
          }
        }
      } else {
        // WMS and other non-animated layers
        const tileLayer = this.layerRenderService.createTileLayer(layerId, controls);
        desiredLayersOnMap.set(layerId, { tileLayer, targetOpacity });

        if (controls.zIndex !== undefined) {
          const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);
          if (absoluteZIndex !== undefined) tileLayer.setZIndex(absoluteZIndex);
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
