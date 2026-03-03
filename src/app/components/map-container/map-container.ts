import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  effect,
  signal,
  computed,
  ViewContainerRef,
  Injector,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as L from 'leaflet';
import 'leaflet-editable';
import { MAP_CONFIG } from '../../config';

import { LayerControlService } from '../../services/layers/layer-control.service';
import { LayerConfigService } from '../../services/layers/layer-config.service';
import { TilePrefetchService } from '../../services/layers/tile-prefetch.service';
import { BaseMap } from '../../models';
import { BaseMapService } from '../../services/base-maps/base-map.service';
import { PolygonService } from '../../services/polygons/polygon.service';
import {
  PolygonDrawingService,
  DrawingMode,
} from '../../services/polygons/polygon-drawing.service';
import {
  PolygonEditControlsComponent,
  PolygonEditAction,
} from '../polygon-edit-controls/polygon-edit-controls';

import { MapLayersService } from '../../services/layers/map-layers.service';
import { MapPolygonsService } from '../../services/polygons/map-polygons.service';

/**
 * Main map container component that orchestrates the map, layers, and polygons
 */
@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, PolygonEditControlsComponent],
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
  private viewContainerRef = inject(ViewContainerRef);
  private injector = inject(Injector);

  // Services
  private layersService = inject(MapLayersService);
  private polygonsService = inject(MapPolygonsService);

  private currentTileLayer: L.TileLayer | null = null;
  private ignoreNextMapEvents = false;

  // Expose properties to template
  readonly drawingMode = this.polygonDrawingService.drawingMode;
  readonly editingPolygonId = this.polygonDrawingService.editingPolygonId;
  readonly isEditingPolygon = computed(
    () => this.drawingMode() === DrawingMode.EDIT && !!this.editingPolygonId(),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Effect: change base map
      effect(() => {
        const baseMap = this.baseMapService.currentBaseMap();
        if (this.map) {
          this.changeBaseMap(baseMap);
        }
      });

      // Effect: synchronize satellite/radar layers
      effect(() => {
        const layers = this.controlService.activeLayers();
        const layerIds = layers.map((item) => item.layer.id);

        // Also track config signal to re-trigger when configs are loaded
        this.layerConfigService.configs();

        if (this.map) {
          this.layersService.syncLayers(layerIds);
        }
      });

      // Effect: synchronize zoom when currentZoom signal changes
      effect(() => {
        const targetZoom = this.currentZoom();
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

  currentZoom = signal<number>(MAP_CONFIG.initialZoom);

  canZoomIn = computed(() => {
    return this.currentZoom() < MAP_CONFIG.maxZoom;
  });

  canZoomOut = computed(() => {
    return this.currentZoom() > MAP_CONFIG.minZoom;
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    this.layersService.destroy();
    this.polygonsService.destroy();

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
      doubleClickZoom: true, // Will be disabled during polygon drawing
      editable: true,
    });

    // Initialize services with the map instance
    this.layersService.initialize(this.map);
    this.polygonsService.initialize(this.map, this.viewContainerRef, this.injector);

    // Prevent UI controls from interfering with map/polygon drawing
    this.disableMapEventsOnUIElements();

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

    // Initialize base map layer
    const initialBaseMap = this.baseMapService.getCurrentBaseMap();
    this.changeBaseMap(initialBaseMap);
  }

  /**
   * Disable map events on UI elements to prevent interference with drawing
   */
  private disableMapEventsOnUIElements(): void {
    // Wait a bit for Angular to render the DOM
    setTimeout(() => {
      // Disable click propagation on zoom controls
      const zoomControls = document.querySelector('.zoom-controls');
      if (zoomControls) {
        L.DomEvent.disableClickPropagation(zoomControls as HTMLElement);
        L.DomEvent.disableScrollPropagation(zoomControls as HTMLElement);
      }

      // Disable click propagation on main menu
      const mainMenu = document.querySelector('.main-menu-wrapper');
      if (mainMenu) {
        L.DomEvent.disableClickPropagation(mainMenu as HTMLElement);
        L.DomEvent.disableScrollPropagation(mainMenu as HTMLElement);
      }

      // Also check for edit controls periodically since they appear dynamically
      const checkEditControls = () => {
        const editControls = document.querySelector('.edit-controls-container');
        if (editControls && !(editControls as any)._leaflet_disable_click) {
          L.DomEvent.disableClickPropagation(editControls as HTMLElement);
          L.DomEvent.disableScrollPropagation(editControls as HTMLElement);
        }
      };

      // Run check every second to catch edit controls when they appear
      setInterval(checkEditControls, 1000);
    }, 100);
  }

  private changeBaseMap(baseMap: BaseMap): void {
    if (!this.map) return;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = L.tileLayer(baseMap.url, {
      attribution: baseMap.attribution,
      maxZoom: baseMap.maxZoom,
      zIndex: 0,
    }).addTo(this.map);
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

  /**
   * Handle polygon edit actions from the UI controls
   */
  handleEditAction(action: PolygonEditAction): void {
    const editingId = this.editingPolygonId();

    if (action.type === 'save') {
      this.polygonsService.savePolygonEdit(editingId);
    } else if (action.type === 'cancel') {
      this.polygonsService.cancelPolygonEdit(editingId);
    }
  }
}
