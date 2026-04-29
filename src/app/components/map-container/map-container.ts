import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-editable';
import { MAP_CONFIG, MAP_Z_INDEX } from '../../config';
import { environment } from '../../../environments/environment';

import { LayerControlService } from '../../services/layers/layer-control.service';
import { LayerConfigService } from '../../services/layers/layer-config.service';
import { TilePrefetchService } from '../../services/layers/tile-prefetch.service';
import { PointQueryViewerService } from '../../services/layers/point-query-tools.service';
import { MapInfoService } from '../../services/layers/map-info.service';
import { BaseMap } from '../../models';
import { BaseMapService } from '../../services/base-maps/base-map.service';
import { PolygonService } from '../../services/polygons/polygon.service';
import { PolygonDrawingService } from '../../services/polygons/polygon-drawing.service';
import { MapLayersService } from '../../services/layers/map-layers.service';
import { MapPolygonsService } from '../../services/polygons/map-polygons.service';
import { VectorOverlayService } from '../../services/layers/vector-overlay.service';

/**
 * Main map container component that orchestrates the map, layers, polygons and point-query UI.
 */
@Component({
  selector: 'app-map-container',
  standalone: true,
  templateUrl: './map-container.html',
  styleUrl: './map-container.scss',
})
export class MapContainer implements OnInit, OnDestroy {
  private map: L.Map | null = null;
  private platformId = inject(PLATFORM_ID);
  private baseMapService = inject(BaseMapService);
  private controlService = inject(LayerControlService);
  private layerConfigService = inject(LayerConfigService);
  private prefetchService = inject(TilePrefetchService);
  private polygonService = inject(PolygonService);
  private polygonDrawingService = inject(PolygonDrawingService);
  private pointQueryViewerService = inject(PointQueryViewerService);
  private mapInfoService = inject(MapInfoService);

  // Services
  private layersService = inject(MapLayersService);
  private polygonsService = inject(MapPolygonsService);
  private vectorOverlayService = inject(VectorOverlayService);

  private currentTileLayer: L.TileLayer | null = null;

  readonly showZoom = this.mapInfoService.showZoom;

  readonly editingPolygonId = this.polygonDrawingService.editingPolygonId;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Effect: change base map
      effect(() => {
        const baseMap = this.baseMapService.currentBaseMap();
        if (this.map && baseMap) {
          this.changeBaseMap(baseMap);
        }
      });

      // Effect: synchronize satellite/radar layers
      effect(() => {
        const layers = this.controlService.activeLayers();
        const layerIds = layers.map((item) => item.layer.id);

        // Also track config signal to re-trigger when configs are loaded
        this.layerConfigService.configs();
        // Track vector overlay loads so isobars/secondary overlays appear as
        // soon as their GeoJSON arrives.
        this.vectorOverlayService.loadTick();

        if (this.map) {
          this.layersService.syncLayers(layerIds);
        }
      });

      // Effect: synchronize zoom when currentZoom signal changes
      effect(() => {
        const targetZoom = this.mapInfoService.currentZoom();
        if (this.map) {
          const currentMapZoom = Math.round(this.map.getZoom());
          if (currentMapZoom !== targetZoom) {
            this.map.setZoom(targetZoom);
          }
        }
      });

      // Effect: synchronize visible polygons
      effect(() => {
        const polygons = this.polygonService.allPolygons();
        const editingId = this.editingPolygonId();
        if (this.map) {
          this.polygonsService.syncPolygons(polygons, editingId);
        }
      });

      // Effect: handle drawing mode changes
      effect(() => {
        const mode = this.polygonDrawingService.drawingMode();
        const editingPolygonId = this.polygonDrawingService.editingPolygonId();
        if (this.map) {
          this.polygonsService.handleDrawingModeChange(mode, editingPolygonId);
        }
      });
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.pointQueryViewerService.initialize();
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    this.layersService.destroy();
    this.polygonsService.destroy();
    this.mapInfoService.destroy();

    // Clear event blocking interval
    if ((this as any)._eventBlockingInterval) {
      clearInterval((this as any)._eventBlockingInterval);
    }

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
      attributionControl: false,
      doubleClickZoom: true, // Will be disabled during polygon drawing
      editable: true,
    } as L.MapOptions & { editable: boolean });

    // Initialize services with the map instance
    this.layersService.initialize(this.map);
    this.polygonsService.initialize(this.map);
    this.mapInfoService.initialize(this.map);

    // Prevent UI elements from propagating events to the map
    this.preventUIEventPropagation();

    // Update zoom signal from map events (user scrolling or programmatic changes)
    this.map.on('zoom', () => {
      const mapZoom = this.map?.getZoom();
      if (mapZoom !== undefined) {
        this.mapInfoService.setCurrentZoom(Math.round(mapZoom));
      }
    });

    this.map.on('zoomend', () => {
      const mapZoom = this.map?.getZoom();
      if (mapZoom !== undefined) {
        this.prefetchService.setZoom(Math.round(mapZoom));
      }
    });

    // Initialize base map layer if providers have already loaded; otherwise
    // the effect above will install it as soon as the API call resolves.
    const initialBaseMap = this.baseMapService.getCurrentBaseMap();
    if (initialBaseMap) {
      this.changeBaseMap(initialBaseMap);
    }

    this.map.on('mousemove', (event: L.LeafletMouseEvent) => {
      this.pointQueryViewerService.handleMouseMove(event.latlng.lat, event.latlng.lng);
    });

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.polygonsService.closeContextMenu();
      const button = (event.originalEvent as MouseEvent | undefined)?.button ?? 0;
      this.pointQueryViewerService.handleMapClick(event.latlng.lat, event.latlng.lng, button);
    });
  }

  /**
   * Prevent UI elements from propagating events to the map and cancel drawing on button clicks
   */
  private preventUIEventPropagation(): void {
    // Apply L.DomEvent.disableClickPropagation to main UI containers
    const applyEventBlocking = (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element && !(element as any)._leaflet_disable_events) {
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
        (element as any)._leaflet_disable_events = true;
      }
    };

    // Check periodically for UI elements and apply event blocking
    const checkAndApply = () => {
      applyEventBlocking('.main-menu-wrapper');
      applyEventBlocking('.zoom-controls');
      applyEventBlocking('.scale-tools-container');
    };

    // Initial check
    setTimeout(checkAndApply, 100);

    // Periodic check for dynamically added elements
    const intervalId = setInterval(checkAndApply, 1000);

    // Store interval ID for cleanup
    (this as any)._eventBlockingInterval = intervalId;
  }

  private changeBaseMap(baseMap: BaseMap): void {
    if (!this.map) return;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = L.tileLayer(baseMap.url, {
      attribution: baseMap.attribution,
      maxZoom: baseMap.maxZoom,
      zIndex: MAP_Z_INDEX.BASE_MAP,
      maxNativeZoom: baseMap.maxNativeZoom,
      // Wider tile ring smooths panning; backend's 1-week immutable cache
      // makes the extra fetches near-free on warm caches.
      keepBuffer: 4,
      // Defer tile fetches during touch pinch/pan; smoother on coarse pointers.
      updateWhenIdle: window.matchMedia?.('(pointer: coarse)').matches ?? false,
      // Future-proofs canvas screenshot/print flows; backend already CORS-allows *.
      crossOrigin: 'anonymous',
      zIndex: 0,
    }).addTo(this.map);

    // Tripwire: backend is supposed to return a transparent PNG on miss, never a 404.
    // If `tileerror` ever fires for the basemap layer, a backend regression is the prime suspect.
    if (!environment.production) {
      this.currentTileLayer.on('tileerror', (e) => {
        console.warn(
          '[basemap] unexpected tileerror — backend should serve transparent PNG on miss',
          e,
        );
      });
    }
  }
}
