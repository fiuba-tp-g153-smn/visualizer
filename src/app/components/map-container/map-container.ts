import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DomEvent,
  LeafletMouseEvent,
  Map as LeafletMap,
  TileErrorEvent,
  TileLayer,
  map,
  tileLayer,
} from 'leaflet';
import { MAP_CONFIG, MAP_Z_INDEX } from '../../config';

import { LayerControlService } from '../../services/layers/layer-control.service';
import { LayerConfigService } from '../../services/layers/layer-config.service';
import { TilePrefetchService } from '../../services/layers/tile-prefetch.service';
import { PointQueryViewerService } from '../../services/tools/point-query-viewer.service';
import { MapInfoService } from '../../services/layers/map-info.service';
import { BaseMap } from '../../models';
import { BaseMapService } from '../../services/base-maps/base-map.service';
import { PolygonService } from '../../services/polygons/polygon.service';
import { PolygonDrawingService } from '../../services/polygons/polygon-drawing.service';
import { MapLayersService } from '../../services/layers/map-layers.service';
import { MapPolygonsService } from '../../services/polygons/map-polygons.service';
import { ActiveAlertsMapService } from '../../services/active-alerts/active-alerts-map.service';
import { VectorOverlayService } from '../../services/layers/vector-overlay.service';
import { LayerRefreshService } from '../../services/layers/layer-refresh.service';
import { UnitsSettingsService } from '../../services/settings/units-settings.service';

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
  private map: LeafletMap | null = null;
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
  private activeAlertsMapService = inject(ActiveAlertsMapService);
  private vectorOverlayService = inject(VectorOverlayService);
  private layerRefreshService = inject(LayerRefreshService);
  private unitsSettings = inject(UnitsSettingsService);

  private currentTileLayer: TileLayer | null = null;
  private currentBaseMapUrl: string | null = null;

  readonly showZoom = this.mapInfoService.showZoom;

  readonly editingPolygonId = this.polygonDrawingService.editingPolygonId;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const baseMap = this.baseMapService.currentBaseMap();
        if (this.map && baseMap) {
          this.changeBaseMap(baseMap);
        }
      });

      effect(() => {
        const layers = this.controlService.activeLayers();
        const layerIds = layers.map((item) => item.layer.id);

        // Also track config signal to re-trigger when configs are loaded
        this.layerConfigService.configs();
        // Track vector overlay loads so isobars/secondary overlays appear as
        // soon as their GeoJSON arrives.
        this.vectorOverlayService.loadTick();
        // Track station data loads so marker layers appear as soon as the data
        // cache is populated.
        this.layerRefreshService.weatherStationsLoadTick();
        // Re-render point layers when the zoom changes so marker sizes can adapt.
        this.mapInfoService.currentZoom();
        // Re-render layers that depend on display units (e.g. weather station badges/popups).
        this.unitsSettings.temperatureUnit();
        this.unitsSettings.windSpeedUnit();

        if (this.map) {
          this.layersService.syncLayers(layerIds);
        }
      });

      effect(() => {
        const targetZoom = this.mapInfoService.currentZoom();
        if (this.map) {
          const currentMapZoom = Math.round(this.map.getZoom());
          if (currentMapZoom !== targetZoom) {
            this.map.setZoom(targetZoom);
          }
        }
      });

      effect(() => {
        const polygons = this.polygonService.allPolygons();
        const editingId = this.editingPolygonId();
        if (this.map) {
          this.polygonsService.syncPolygons(polygons, editingId);
        }
      });

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
    this.map = map('map', {
      center: [MAP_CONFIG.initialCenter.lat, MAP_CONFIG.initialCenter.lng],
      zoom: MAP_CONFIG.initialZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      maxBounds: MAP_CONFIG.maxBounds,
      maxBoundsViscosity: MAP_CONFIG.maxBoundsViscosity,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: true, // Will be disabled during polygon drawing
      // Note: `editable: true` is intentionally omitted — leaflet-editable is
      // loaded on demand (see MapPolygonsService.ensureEditTools), so editTools
      // is wired up the first time the user enters draw/edit mode.
    });

    this.layersService.initialize(this.map);
    this.polygonsService.initialize(this.map);
    this.activeAlertsMapService.initialize(this.map);
    this.mapInfoService.initialize(this.map);

    this.preventUIEventPropagation();

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

    const initialBaseMap = this.baseMapService.getCurrentBaseMap();
    if (initialBaseMap) {
      this.changeBaseMap(initialBaseMap);
    }

    this.map.on('click', (event: LeafletMouseEvent) => {
      this.polygonsService.closeContextMenu();
      const button = (event.originalEvent as MouseEvent | undefined)?.button ?? 0;
      this.pointQueryViewerService.handleMapClick(event.latlng.lat, event.latlng.lng, button);
    });
  }

  private preventUIEventPropagation(): void {
    const applyEventBlocking = (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element && !(element as any)._leaflet_disable_events) {
        DomEvent.disableClickPropagation(element);
        DomEvent.disableScrollPropagation(element);
        (element as any)._leaflet_disable_events = true;
      }
    };

    const checkAndApply = () => {
      applyEventBlocking('.main-menu-wrapper');
      applyEventBlocking('.zoom-controls');
      applyEventBlocking('.scale-tools-container');
    };

    setTimeout(checkAndApply, 100);

    const intervalId = setInterval(checkAndApply, 1000);

    (this as any)._eventBlockingInterval = intervalId;
  }

  private changeBaseMap(baseMap: BaseMap): void {
    if (!this.map) return;

    // Effective tile URL: direct upstream (IGN, ArcGIS, …) when available,
    // falling back to the data-service proxy otherwise.
    const tileUrl = baseMap.directUrl ?? baseMap.url;

    // Reconciliation of the optimistic base map (same provider, possibly refined
    // metadata once /basemap/providers resolves): the tiles are identical, so
    // refresh maxNativeZoom in place instead of tearing the layer down — avoids
    // a flicker. A real base-map switch (different URL) falls through to rebuild.
    if (this.currentTileLayer && tileUrl === this.currentBaseMapUrl) {
      this.currentTileLayer.options.maxNativeZoom = baseMap.maxNativeZoom;
      return;
    }

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentBaseMapUrl = tileUrl;
    this.currentTileLayer = tileLayer(tileUrl, {
      attribution: baseMap.attribution,
      maxZoom: baseMap.maxZoom,
      zIndex: MAP_Z_INDEX.BASE_MAP,
      maxNativeZoom: baseMap.maxNativeZoom,
      className: 'basemap-tile',
      // Wider tile ring smooths panning; backend's 1-week immutable cache
      // makes the extra fetches near-free on warm caches.
      keepBuffer: 4,
      // Defer tile fetches during touch pinch/pan; smoother on coarse pointers.
      updateWhenIdle: window.matchMedia?.('(pointer: coarse)').matches ?? false,
      // Avoid subpixel cracks while zooming animated tiles in some browsers.
      updateWhenZooming: false,
      // TMS providers (argenmap family) store tiles with Y=0 at bottom;
      // Leaflet flips Y automatically when this is true.
      tms: baseMap.isTms,
    }).addTo(this.map);

    // When a direct upstream tile fails, swap to the data-service fallback URL.
    // The data-service handles TMS Y-flip internally, so coords (XYZ) map directly.
    // `fallbackUsed` guards against retriggering tileerror on the fallback itself.
    if (baseMap.directUrl) {
      this.currentTileLayer.on('tileerror', (e: TileErrorEvent) => {
        const tile = e.tile as HTMLImageElement;
        if (tile.dataset['fallbackUsed']) return;
        tile.dataset['fallbackUsed'] = '1';
        const { x, y, z } = e.coords;
        tile.src = baseMap.url
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(y));
      });
    }
  }
}
