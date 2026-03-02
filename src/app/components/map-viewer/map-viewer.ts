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
import { TilePrefetchService } from '../../services/layers/tile-prefetch.service';
import { BaseMap, LayerCategory, GoesLayerControls, RadarLayerControls } from '../../models';
import { BaseMapService } from '../../services/base-maps/base-map.service';
import { PolygonService } from '../../services/polygons/polygon.service';
import { PolygonDrawingService } from '../../services/polygons/polygon-drawing.service';
import { Polygon } from '../../models/polygon.model';

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
  private baseMapService = inject(BaseMapService);
  private layersService = inject(LayersService);
  private controlService = inject(LayerControlService);
  private layerRenderService = inject(LayerRenderService);
  private prefetchService = inject(TilePrefetchService);
  private polygonService = inject(PolygonService);
  private polygonDrawingService = inject(PolygonDrawingService);

  private currentTileLayer: L.TileLayer | null = null;
  private drawnItems: L.FeatureGroup | null = null;
  private polygonLayers = new Map<string, L.Polygon>();
  private polygonDrawHandler: L.Draw.Polygon | null = null;
  private polygonEditHandler: L.EditToolbar.Edit | null = null;
  private polygonDeleteHandler: L.EditToolbar.Delete | null = null;

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
        if (this.map && this.drawnItems) {
          this.handleDrawingModeChange(mode);
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
      const controls = this.controlService.getControls(layerId);

      if (!layer || !controls || !controls.visible) continue;

      const absoluteZIndex = this.controlService.getAbsoluteZIndex(layerId, controls);

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

    // Debug: log drawing events
    this.map.on('draw:drawvertex', (e: any) => {
      console.log('Vertex drawn:', e.layers.getLayers().length, 'vertices');
    });
    this.map.on('draw:drawstop', () => {
      console.log('Drawing stopped');
    });
  }

  /**
   * Crea un nuevo handler de dibujo de polígonos
   */
  private createPolygonDrawHandler(): L.Draw.Polygon {
    console.log('Creating new polygon draw handler');

    const polygonOptions: L.DrawOptions.PolygonOptions = {
      allowIntersection: false,
      showArea: true,
      showLength: true,
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
        color: '#2196F3',
        weight: 3,
        opacity: 0.8,
        fill: true,
        fillColor: '#2196F3',
        fillOpacity: 0.2,
        clickable: true,
      },
      repeatMode: false,
      guidelineDistance: 20,
      maxGuideLineLength: 4000,
    };

    const handler = new L.Draw.Polygon(this.map as L.DrawMap, polygonOptions);
    console.log('Polygon handler created, options:', polygonOptions);
    return handler;
  }

  /**
   * Maneja el cambio de modo de dibujo
   */
  private handleDrawingModeChange(mode: 'none' | 'draw' | 'edit' | 'delete'): void {
    if (!this.map || !this.drawnItems) return;

    console.log('Drawing mode changed to:', mode);

    // Disable all active modes first
    this.polygonDrawHandler?.disable();
    this.polygonEditHandler?.disable();
    this.polygonDeleteHandler?.disable();

    // Enable the requested mode
    switch (mode) {
      case 'draw':
        // Disable double-click zoom to avoid conflicts
        this.map.doubleClickZoom.disable();
        console.log('Double-click zoom disabled');

        // Create a fresh handler each time to avoid state issues
        this.polygonDrawHandler = this.createPolygonDrawHandler();
        this.polygonDrawHandler.enable();
        console.log('Polygon drawing enabled');
        if (!this.polygonEditHandler) {
          this.polygonEditHandler = new L.EditToolbar.Edit(this.map as L.DrawMap, {
            featureGroup: this.drawnItems,
            selectedPathOptions: {
              opacity: 0.6,
            },
          });
        }
        this.polygonEditHandler.enable();
        break;

      case 'delete':
        // Re-enable double-click zoom if it was disabled
        this.map.doubleClickZoom.enable();

        if (!this.polygonDeleteHandler) {
          this.polygonDeleteHandler = new L.EditToolbar.Delete(this.map as L.DrawMap, {
            featureGroup: this.drawnItems,
          });
        }
        this.polygonDeleteHandler.enable();
        break;

      case 'none':
        // Re-enable double-click zoom
        this.map.doubleClickZoom.enable();
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

    console.log('Polygon created with', coordinates.length, 'vertices:', coordinates);

    // Create polygon in service
    const polygon = this.polygonService.createPolygon({
      name: '',
      coordinates,
    });

    // Store polygon id in layer options and reference
    layer.options.polygonId = polygon.id;
    this.polygonLayers.set(polygon.id, layer);

    // Leaflet.draw already adds the layer to drawnItems, so we don't add it again
    // Just ensure it's there and properly configured
    if (!this.drawnItems?.hasLayer(layer)) {
      this.drawnItems?.addLayer(layer);
    }

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

    // Process all polygons from service
    for (const polygon of polygons) {
      const existingLayer = this.polygonLayers.get(polygon.id);

      if (polygon.visible) {
        if (existingLayer) {
          // Update existing layer style and coordinates
          existingLayer.setStyle({
            color: polygon.color,
            fillColor: polygon.color,
            fillOpacity: 0.2,
          });

          // Update coordinates if they changed
          const latlngs: L.LatLngExpression[] = polygon.coordinates.map((coord) => [
            coord[0],
            coord[1],
          ]);
          existingLayer.setLatLngs(latlngs);

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
