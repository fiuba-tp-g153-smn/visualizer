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
    // Cancel fading-out timers and remove their layers
    this.fadingOutLayers.forEach(({ layer, timerId }) => {
      clearTimeout(timerId);
      layer.remove();
    });
    this.fadingOutLayers.clear();

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

  private static readonly FRAME_TRANSITION_MS = 300;
  private static readonly DOM_PREFETCH_RADIUS = 2;
  private readonly fadingOutLayers = new Map<
    string,
    { layer: L.TileLayer; timerId: ReturnType<typeof setTimeout> }
  >();

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
          if (totalFrames > 0) {
            for (let offset = -MapViewer.DOM_PREFETCH_RADIUS; offset <= MapViewer.DOM_PREFETCH_RADIUS; offset++) {
              if (offset === 0) continue;
              const adjIndex = currentTimeIndex + offset;
              if (adjIndex < 0 || adjIndex >= totalFrames) continue;
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
        if (totalFrames > 0) {
          for (let offset = -MapViewer.DOM_PREFETCH_RADIUS; offset <= MapViewer.DOM_PREFETCH_RADIUS; offset++) {
            if (offset === 0) continue;
            const adjIndex = currentTimeIndex + offset;
            if (adjIndex < 0 || adjIndex >= totalFrames) continue;
            const adjLayer = this.layerRenderService.createTileLayerForTimeIndex(
              layerId,
              goesControls,
              adjIndex,
            );
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

    // 1. Fade out layers that are no longer desired OR need to be replaced
    for (const [key, oldLayer] of this.onMapLayers) {
      const desired = desiredLayersOnMap.get(key);
      if (!desired || desired.tileLayer !== oldLayer) {
        // Cancel any existing fade-out for this key
        const existing = this.fadingOutLayers.get(key);
        if (existing) clearTimeout(existing.timerId);

        const el = (oldLayer as any)._container as HTMLElement | undefined;
        if (el) el.style.transition = `opacity ${MapViewer.FRAME_TRANSITION_MS}ms ease-in-out`;
        oldLayer.setOpacity(0);
        const timerId = setTimeout(() => {
          this.map?.removeLayer(oldLayer);
          this.fadingOutLayers.delete(key);
        }, MapViewer.FRAME_TRANSITION_MS);
        this.fadingOutLayers.set(key, { layer: oldLayer, timerId });
      }
    }

    // 2. Add new layers or update opacity on same-instance layers
    for (const [key, { tileLayer, targetOpacity }] of desiredLayersOnMap) {
      const oldLayer = this.onMapLayers.get(key);
      if (!oldLayer || oldLayer !== tileLayer) {
        // New or replaced layer: cancel any pending removal, then fade in from 0
        const pendingRemoval = this.fadingOutLayers.get(key);
        if (pendingRemoval) {
          clearTimeout(pendingRemoval.timerId);
          this.fadingOutLayers.delete(key);
        }
        tileLayer.setOpacity(0);
        tileLayer.addTo(this.map!);
        const el = (tileLayer as any)._container as HTMLElement | undefined;
        if (el) el.style.transition = `opacity ${MapViewer.FRAME_TRANSITION_MS}ms ease-in-out`;
        // Microtask lets browser paint opacity-0 before starting transition
        Promise.resolve().then(() => tileLayer.setOpacity(targetOpacity));
      } else {
        // Same layer instance (e.g. frame transition via pre-fetch, or opacity slider change):
        // apply opacity with CSS transition so the change is smooth
        const el = (tileLayer as any)._container as HTMLElement | undefined;
        if (el) el.style.transition = `opacity ${MapViewer.FRAME_TRANSITION_MS}ms ease-in-out`;
        tileLayer.setOpacity(targetOpacity);
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
