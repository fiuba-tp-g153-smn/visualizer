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
  ComponentRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import * as L from 'leaflet';
import 'leaflet-draw';
import { MAP_CONFIG } from '../../config';

// Extended types for leaflet-draw
declare module 'leaflet' {
  interface PolylineOptions {
    polygonId?: string;
  }
}

import { LayersService } from '../../services/layers/layers.service';
import { LayerControlService } from '../../services/layers/layer-control.service';
import { LayerRenderService } from '../../services/layers/layer-render.service';
import { LayerConfigService } from '../../services/layers/layer-config.service';
import { TilePrefetchService } from '../../services/layers/tile-prefetch.service';
import {
  BaseMap,
  LayerCategory,
  GoesLayerControls,
  RadarLayerControls,
  LayerType,
} from '../../models';
import { BaseMapService } from '../../services/base-maps/base-map.service';
import { PolygonService } from '../../services/polygons/polygon.service';
import {
  PolygonDrawingService,
  DrawingMode,
} from '../../services/polygons/polygon-drawing.service';
import { Polygon } from '../../models/polygon.model';
import {
  PolygonContextMenuComponent,
  PolygonContextMenuAction,
} from '../polygon-context-menu/polygon-context-menu';
import {
  PolygonEditControlsComponent,
  PolygonEditAction,
} from '../polygon-edit-controls/polygon-edit-controls';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, PolygonEditControlsComponent],
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
})
export class MapViewer implements OnInit, OnDestroy {
  private map: L.Map | null = null;
  private platformId = inject(PLATFORM_ID);
  private baseMapService = inject(BaseMapService);
  private layersService = inject(LayersService);
  private controlService = inject(LayerControlService);
  private layerConfigService = inject(LayerConfigService);
  private layerRenderService = inject(LayerRenderService);
  private prefetchService = inject(TilePrefetchService);
  private polygonService = inject(PolygonService);
  private polygonDrawingService = inject(PolygonDrawingService);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private injector = inject(Injector);

  private currentTileLayer: L.TileLayer | null = null;
  private drawnItems: L.FeatureGroup | null = null;
  private polygonLayers = new Map<string, L.Polygon>();
  private polygonDrawHandler: L.Draw.Polygon | null = null;
  private polygonEditHandler: L.EditToolbar.Edit | null = null;
  private polygonDeleteHandler: L.EditToolbar.Delete | null = null;
  private contextMenuOverlayRef: OverlayRef | null = null;

  // Store original coordinates before editing for cancellation
  private originalCoordinates: Array<[number, number]> | null = null;

  // Expose drawing mode and editing polygon ID to template
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

      // Effect: sincronizar capas satelitales
      effect(() => {
        const layers = this.controlService.activeLayers();
        const layerIds = layers.map((item) => item.layer.id);

        // Also track config signal to re-trigger when configs are loaded
        this.layerConfigService.configs();

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

      // Effect: sincronizar polígonos visibles
      effect(() => {
        const polygons = this.polygonService.allPolygons();
        if (this.map && this.drawnItems) {
          this.syncPolygons(polygons);
        }
      });

      // Effect: cambiar modo de dibujo
      effect(() => {
        const mode = this.polygonDrawingService.drawingMode();
        const editingPolygonId = this.polygonDrawingService.editingPolygonId();
        if (this.map && this.drawnItems) {
          this.handleDrawingModeChange(mode, editingPolygonId);
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
      doubleClickZoom: true, // Will be disabled during polygon drawing
    });

    // Initialize polygon drawing
    this.initPolygonDrawing();

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

  private onMapLayers = new Map<string, L.TileLayer>();

  private syncLayers(layerIds: string[]): void {
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
   * Inicializa los controles de dibujo de polígonos
   */
  private initPolygonDrawing(): void {
    if (!this.map) return;

    // Create a feature group to hold all drawn polygons
    this.drawnItems = new L.FeatureGroup();
    this.map.addLayer(this.drawnItems);

    // Event handlers
    this.map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      this.onPolygonCreated(e as L.DrawEvents.Created);
    });
    this.map.on(L.Draw.Event.EDITED, (e: L.LeafletEvent) => {
      this.onPolygonEdited(e as L.DrawEvents.Edited);
    });
    this.map.on(L.Draw.Event.DELETED, (e: L.LeafletEvent) => {
      this.onPolygonDeleted(e as L.DrawEvents.Deleted);
    });
  }

  /**
   * Crea un nuevo handler de dibujo de polígonos
   */
  private createPolygonDrawHandler(): L.Draw.Polygon {
    // Get the color that will be used for the next polygon
    const nextColor = this.polygonService.getNextAvailableColor();

    const polygonOptions: L.DrawOptions.PolygonOptions = {
      allowIntersection: false,
      showArea: false, // Disabled to avoid readableArea bug
      showLength: false,
      metric: true,
      feet: false,
      nautic: false,
      drawError: {
        color: '#e1e100',
        message: '<strong>Error:</strong> Los bordes del polígono no pueden cruzarse',
        timeout: 1000,
      },
      shapeOptions: {
        stroke: true,
        color: nextColor,
        weight: 3,
        opacity: 0.8,
        fill: true,
        fillColor: nextColor,
        fillOpacity: 0.2,
        clickable: true,
      },
      icon: new L.DivIcon({
        html:
          '<div class="custom-polygon-marker" style="background-color: ' + nextColor + ';"></div>',
        className: 'custom-polygon-marker-container',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
      touchIcon: new L.DivIcon({
        html:
          '<div class="custom-polygon-marker" style="background-color: ' + nextColor + ';"></div>',
        className: 'custom-polygon-marker-container',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      repeatMode: false,
      guidelineDistance: 20,
      maxGuideLineLength: 4000,
    };

    const handler = new L.Draw.Polygon(this.map as L.DrawMap, polygonOptions);
    return handler;
  }

  /**
   * Maneja el cambio de modo de dibujo
   */
  private handleDrawingModeChange(mode: DrawingMode, editingPolygonId: string | null): void {
    if (!this.map || !this.drawnItems) return;

    // Disable all active modes first
    this.polygonDrawHandler?.disable();
    this.polygonEditHandler?.disable();
    this.polygonDeleteHandler?.disable();

    // Disable editing on all polygons
    this.drawnItems.eachLayer((layer) => {
      if (layer instanceof L.Polygon && (layer as any).editing) {
        (layer as any).editing.disable();
      }
    });

    // Ensure all polygon layers are in drawnItems for editing capabilities
    this.polygonLayers.forEach((layer) => {
      if (!this.drawnItems!.hasLayer(layer)) {
        this.drawnItems!.addLayer(layer);
      }
    });

    // Enable the requested mode
    switch (mode) {
      case DrawingMode.DRAW:
        // Disable double-click zoom to avoid conflicts
        this.map.doubleClickZoom.disable();

        // Create a fresh handler each time to avoid state issues
        this.polygonDrawHandler = this.createPolygonDrawHandler();
        this.polygonDrawHandler.enable();
        break;

      case DrawingMode.EDIT:
        if (editingPolygonId) {
          // Edit specific polygon
          const layer = this.polygonLayers.get(editingPolygonId);
          if (layer) {
            const latlngs = layer.getLatLngs()[0] as L.LatLng[];

            // Save original coordinates before editing for potential cancellation
            this.originalCoordinates = latlngs.map((ll) => [ll.lat, ll.lng]);

            // Ensure the layer is editable
            if (!(layer as any).editing) {
              if (!this.drawnItems.hasLayer(layer)) {
                this.drawnItems.addLayer(layer);
              }
            }

            if ((layer as any).editing) {
              // Get polygon color for custom markers
              const polygonColor = (layer.options as any).color || '#3388ff';

              // Apply dashed line style
              layer.setStyle({
                dashArray: '5, 5',
              });

              // Set CSS variable on the map container for editing markers to use
              if (this.map) {
                const mapContainer = this.map.getContainer();
                mapContainer.style.setProperty('--polygon-color', polygonColor);
              }

              // Enable editing
              const editHandler = (layer as any).editing;
              editHandler.enable();
            }
          }
        } else {
          // Enable editing for all polygons (fallback, should not happen)
          if (!this.polygonEditHandler) {
            this.polygonEditHandler = new L.EditToolbar.Edit(this.map as L.DrawMap, {
              featureGroup: this.drawnItems,
              selectedPathOptions: {
                opacity: 0.6,
              },
            });
          }
          this.polygonEditHandler.enable();
        }
        break;

      case DrawingMode.DELETE:
        // Re-enable double-click zoom if it was disabled
        this.map.doubleClickZoom.enable();

        if (!this.polygonDeleteHandler) {
          this.polygonDeleteHandler = new L.EditToolbar.Delete(this.map as L.DrawMap, {
            featureGroup: this.drawnItems,
          });
        }
        this.polygonDeleteHandler.enable();
        break;

      case DrawingMode.NONE:
        // Re-enable double-click zoom
        this.map.doubleClickZoom.enable();
        // Clear any saved original coordinates
        this.originalCoordinates = null;
        // All already disabled
        break;
    }
  }

  /**
   * Handler cuando se crea un nuevo polígono
   */
  private onPolygonCreated(e: L.DrawEvents.Created): void {
    if (e.layerType !== 'polygon') return;

    const layer = e.layer as L.Polygon;
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);

    // Create polygon in service
    const polygon = this.polygonService.createPolygon({
      name: '',
      coordinates,
    });

    // Store polygon id in layer options and reference
    layer.options.polygonId = polygon.id;
    this.polygonLayers.set(polygon.id, layer);

    // Add the layer to drawnItems first to enable editing capabilities
    if (this.drawnItems) {
      this.drawnItems.addLayer(layer);
    }

    // Add event listener for edit completion
    layer.on('edit', () => {
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);
      this.polygonService.updatePolygon(polygon.id, { coordinates });
      // Exit edit mode after saving
      this.polygonDrawingService.stopDrawing();
    });

    // Add context menu listener (right click)
    layer.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      this.showPolygonContextMenu(polygon.id, e.containerPoint);
    });

    // Exit drawing mode after creating a polygon (this will re-enable double-click zoom)
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Handler cuando se editan polígonos
   */
  private onPolygonEdited(e: L.DrawEvents.Edited): void {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      const polygon = layer as L.Polygon & { options: { polygonId?: string } };
      const polygonId = polygon.options.polygonId;

      if (polygonId) {
        const latlngs = polygon.getLatLngs()[0] as L.LatLng[];
        const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);

        this.polygonService.updatePolygon(polygonId, { coordinates });
      }
    });
  }

  /**
   * Handler cuando se eliminan polígonos
   */
  private onPolygonDeleted(e: L.DrawEvents.Deleted): void {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      const polygon = layer as L.Polygon & { options: { polygonId?: string } };
      const polygonId = polygon.options.polygonId;

      if (polygonId) {
        this.polygonService.deletePolygon(polygonId);
        this.polygonLayers.delete(polygonId);
      }
    });
  }

  /**
   * Sincroniza los polígonos del servicio con el mapa
   */
  private syncPolygons(polygons: Polygon[]): void {
    if (!this.map || !this.drawnItems) return;

    // Get current polygon IDs on map
    const currentIds = new Set(this.polygonLayers.keys());

    // Get currently editing polygon ID
    const editingId = this.editingPolygonId();

    // Check if the polygon being edited was deleted
    if (editingId && !polygons.find((p) => p.id === editingId)) {
      // Polygon being edited was deleted, exit edit mode
      this.polygonDrawingService.stopDrawing();
      this.originalCoordinates = null;
    }

    // Process all polygons from service
    for (const polygon of polygons) {
      // Skip the polygon being edited to avoid interfering with active edits
      if (editingId && polygon.id === editingId) {
        currentIds.delete(polygon.id);
        continue;
      }

      const existingLayer = this.polygonLayers.get(polygon.id);

      if (polygon.visible) {
        if (existingLayer) {
          // Remove any old 'edit' event listeners that auto-save
          existingLayer.off('edit');

          // Update existing layer style
          existingLayer.setStyle({
            color: polygon.color,
            fillColor: polygon.color,
            fillOpacity: 0.2,
          });

          // Check if coordinates actually changed before updating
          const currentLatLngs = existingLayer.getLatLngs()[0] as L.LatLng[];
          const newCoords = polygon.coordinates;
          let coordsChanged = currentLatLngs.length !== newCoords.length;

          if (!coordsChanged) {
            // Compare each coordinate
            for (let i = 0; i < currentLatLngs.length; i++) {
              const current = currentLatLngs[i];
              const newCoord = newCoords[i];
              if (
                Math.abs(current.lat - newCoord[0]) > 0.000001 ||
                Math.abs(current.lng - newCoord[1]) > 0.000001
              ) {
                coordsChanged = true;
                break;
              }
            }
          }

          if (coordsChanged) {
            const latlngs: L.LatLngExpression[] = newCoords.map((coord) => [coord[0], coord[1]]);
            existingLayer.setLatLngs(latlngs);
          }

          // Ensure the layer is in drawnItems for editing capabilities
          if (!this.drawnItems.hasLayer(existingLayer)) {
            this.drawnItems.addLayer(existingLayer);
          }

          currentIds.delete(polygon.id);
        } else {
          // Create new layer (from localStorage or when making visible again)
          const latlngs: L.LatLngExpression[] = polygon.coordinates.map((coord) => [
            coord[0],
            coord[1],
          ]);
          const layer = L.polygon(latlngs, {
            color: polygon.color,
            fillColor: polygon.color,
            fillOpacity: 0.2,
            polygonId: polygon.id,
          });

          // NOTE: Removed 'edit' event listener that was saving on every vertex drag
          // Saving is now handled manually when user confirms changes

          // Add context menu listener (right click)
          layer.on('contextmenu', (e: L.LeafletMouseEvent) => {
            if (e.originalEvent) {
              L.DomEvent.stopPropagation(e.originalEvent);
              L.DomEvent.preventDefault(e.originalEvent);
            }
            this.showPolygonContextMenu(polygon.id, e.containerPoint);
          });

          this.polygonLayers.set(polygon.id, layer);
          this.drawnItems.addLayer(layer);
          currentIds.delete(polygon.id);
        }
      } else {
        // Hide polygon
        if (existingLayer) {
          this.drawnItems.removeLayer(existingLayer);
          this.polygonLayers.delete(polygon.id);
        }
        currentIds.delete(polygon.id);
      }
    }

    // Remove layers for polygons that no longer exist
    for (const oldId of currentIds) {
      const layer = this.polygonLayers.get(oldId);
      if (layer) {
        this.drawnItems.removeLayer(layer);
        this.polygonLayers.delete(oldId);
      }
    }
  }

  /**
   * Muestra el menú contextual para un polígono usando Angular Material
   */
  private showPolygonContextMenu(polygonId: string, point: L.Point): void {
    const polygon = this.polygonService.getPolygonById(polygonId);

    if (!polygon || !this.map) return;

    // Close any existing context menu
    if (this.contextMenuOverlayRef) {
      this.contextMenuOverlayRef.dispose();
      this.contextMenuOverlayRef = null;
    }

    // Get the map container and calculate absolute position
    const mapContainer = this.map.getContainer();
    const containerRect = mapContainer.getBoundingClientRect();
    const x = containerRect.left + point.x;
    const y = containerRect.top + point.y;

    // Create overlay at the click position
    const positionStrategy = this.overlay.position().global().left(`${x}px`).top(`${y}px`);

    this.contextMenuOverlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });

    // Create and attach the context menu component
    const portal = new ComponentPortal(
      PolygonContextMenuComponent,
      this.viewContainerRef,
      this.injector,
    );
    const componentRef: ComponentRef<PolygonContextMenuComponent> =
      this.contextMenuOverlayRef.attach(portal);

    // Set component inputs
    componentRef.instance.polygonId = polygonId;
    componentRef.instance.polygonVisible = polygon.visible;

    // Handle menu actions
    componentRef.instance.action.subscribe((action: PolygonContextMenuAction) => {
      this.handleContextMenuAction(action);
      this.contextMenuOverlayRef?.dispose();
      this.contextMenuOverlayRef = null;
    });

    // Close menu when backdrop is clicked
    this.contextMenuOverlayRef.backdropClick().subscribe(() => {
      this.contextMenuOverlayRef?.dispose();
      this.contextMenuOverlayRef = null;
    });
  }

  /**
   * Maneja las acciones del menú contextual
   */
  private handleContextMenuAction(action: PolygonContextMenuAction): void {
    switch (action.type) {
      case 'edit':
        setTimeout(() => {
          this.polygonDrawingService.startEditMode(action.polygonId);
        }, 100);
        break;
      case 'visibility':
        setTimeout(() => {
          this.polygonService.toggleVisibility(action.polygonId);
        }, 50);
        break;
      case 'delete':
        setTimeout(() => {
          this.polygonService.deletePolygon(action.polygonId);
        }, 100);
        break;
    }
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
   * Maneja las acciones del componente de controles de edición
   */
  handleEditAction(action: PolygonEditAction): void {
    if (action.type === 'save') {
      this.savePolygonEdit();
    } else if (action.type === 'cancel') {
      this.cancelPolygonEdit();
    }
  }

  /**
   * Guarda las ediciones del polígono actual
   */
  savePolygonEdit(): void {
    const polygonId = this.editingPolygonId();
    if (!polygonId) return;

    const layer = this.polygonLayers.get(polygonId);
    if (layer) {
      // Get current coordinates before disabling
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);

      // Disable editing first to clean up markers
      if ((layer as any).editing) {
        (layer as any).editing.disable();
      }

      // Remove dashed line style
      layer.setStyle({
        dashArray: '',
      });

      // Update polygon in service
      this.polygonService.updatePolygon(polygonId, { coordinates });
    }

    // Clear saved original coordinates
    this.originalCoordinates = null;

    // Exit edit mode
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Cancela las ediciones del polígono actual
   */
  cancelPolygonEdit(): void {
    const polygonId = this.editingPolygonId();

    // Disable editing on the layer first
    if (polygonId) {
      const layer = this.polygonLayers.get(polygonId);
      if (layer) {
        if ((layer as any).editing) {
          (layer as any).editing.disable();
        }

        // Remove dashed line style
        layer.setStyle({
          dashArray: '',
        });

        // Remove the layer and recreate it with original coordinates to avoid breaking edit capabilities
        if (this.originalCoordinates && this.drawnItems) {
          // Remove old layer
          this.drawnItems.removeLayer(layer);
          this.polygonLayers.delete(polygonId);

          // Get polygon data from service
          const polygon = this.polygonService.getPolygonById(polygonId);
          if (polygon) {
            // Create new layer with original coordinates
            const latlngs: L.LatLngExpression[] = this.originalCoordinates.map((coord) => [
              coord[0],
              coord[1],
            ]);
            const newLayer = L.polygon(latlngs, {
              color: polygon.color,
              fillColor: polygon.color,
              fillOpacity: 0.2,
              polygonId: polygon.id,
            });

            // Add context menu listener
            newLayer.on('contextmenu', (e: L.LeafletMouseEvent) => {
              if (e.originalEvent) {
                L.DomEvent.stopPropagation(e.originalEvent);
                L.DomEvent.preventDefault(e.originalEvent);
              }
              this.showPolygonContextMenu(polygon.id, e.containerPoint);
            });

            // Add to map
            this.polygonLayers.set(polygon.id, newLayer);
            this.drawnItems.addLayer(newLayer);
          }
        }
      }
    }

    // Clear saved original coordinates
    this.originalCoordinates = null;

    // Exit edit mode
    this.polygonDrawingService.stopDrawing();
  }
}
