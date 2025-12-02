import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MapDataService } from '../services/map-data.service';
import { LayerService, Layer, LayerType, LayerCategory } from '../services/layer.service';
import { TileService } from '../services/tile.service';
import { PolygonService, DrawingMode } from '../services/polygon.service';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import {
  MapPoint,
  EmaPointData,
  StationPointData,
  VectorField,
  RasterImageData,
  BoundingBox,
} from '../models/map-data.models';

// Colores SMN para polígonos
const SMN_COLORS = ['#1191D0', '#FCB426', '#1D1D1E', '#4bb0e0', '#fdc94d'];

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
})
export class MapViewer implements OnInit, OnDestroy {
  private map: any = null;
  private L: any = null; // Referencia a Leaflet cargado una sola vez
  private platformId = inject(PLATFORM_ID);
  private layerService = inject(LayerService);
  private tileService = inject(TileService);
  private mapDataService = inject(MapDataService);
  private polygonService = inject(PolygonService);

  // Capas activas en el mapa (id -> leaflet layer)
  private activeLayers = new Map<string, any>();
  private currentTileLayer: any = null;

  // Polígonos dibujados
  private drawnItems: any = null;
  private drawControl: any = null;
  private currentDrawHandler: any = null;

  // Control de suscripciones y eventos
  private destroy$ = new Subject<void>();
  private mapMove$ = new Subject<BoundingBox>();

  // Flag para evitar recargas innecesarias del tile layer
  private lastTileProviderId: string | null = null;

  constructor() {
    // Efecto para escuchar cambios en las capas
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const groups = this.layerService.getLayerGroups();
        if (this.map && this.L) {
          this.updateMapLayers(groups);
        }
      });

      // Efecto para escuchar cambios en el tile provider
      effect(() => {
        const provider = this.tileService.getCurrentProvider()();
        if (this.map && this.L && provider) {
          this.changeTileProvider(provider);
        }
      });

      // Efecto para escuchar cambios en el modo de dibujo
      effect(() => {
        const isDrawing = this.polygonService.isDrawing();
        if (this.map && this.L) {
          if (isDrawing) {
            this.enableDrawing();
          } else {
            this.disableDrawing();
          }
        }
      });
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
      this.setupMapMoveHandler();
      this.setupPolygonHandlers();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) {
      this.map.remove();
    }
  }

  // ==========================================================================
  // INICIALIZACIÓN DEL MAPA
  // ==========================================================================

  private async initMap(): Promise<void> {
    // Cargar Leaflet y Leaflet Draw
    this.L = await import('leaflet');
    await import('leaflet-draw');

    this.map = this.L.map('map', {
      center: [-34.6037, -58.3816], // CABA
      zoom: 10,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
    });

    // Control de zoom en posición inferior izquierda
    this.L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    // Inicializar capa de polígonos dibujados
    await this.initDrawnItems();

    // Tile layer inicial (ArgenMAP)
    this.currentTileLayer = this.L.tileLayer(
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
      {
        attribution:
          '<a href="http://leafletjs.com">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">IGN</a> + <a href="http://www.osm.org/copyright" target="_blank">OSM</a>',
        maxZoom: 19,
      }
    ).addTo(this.map);

    this.lastTileProviderId = 'argenmap';

    // Escuchar movimiento del mapa
    this.map.on('moveend', () => {
      const bounds = this.getMapBounds();
      this.mapMove$.next(bounds);
    });

    // Cargar datos iniciales
    this.loadLayerData();
  }

  private setupMapMoveHandler(): void {
    // Debounce para no hacer muchas llamadas al mover el mapa
    this.mapMove$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe((bounds) => {
      this.loadLayerData(bounds);
    });
  }

  // ==========================================================================
  // MANEJO DE TILE PROVIDER
  // ==========================================================================

  private changeTileProvider(provider: any): void {
    if (!this.map || !this.L) return;

    // Evitar recarga si es el mismo provider
    if (this.lastTileProviderId === provider.id) {
      return;
    }

    // Remover tile layer actual
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    // Agregar nuevo tile layer
    this.currentTileLayer = this.L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(this.map);

    this.lastTileProviderId = provider.id;
    console.log('🗺️ Tile provider cambiado a:', provider.name);
  }

  // ==========================================================================
  // MANEJO DE CAPAS
  // ==========================================================================

  private updateMapLayers(groups: any[]): void {
    if (!this.map || !this.L) return;

    groups.forEach((group) => {
      group.layers.forEach((layer: Layer) => {
        this.processLayer(layer);

        // Procesar subcapas
        if (layer.sublayers) {
          layer.sublayers.forEach((sublayer) => this.processLayer(sublayer));
        }
      });
    });
  }

  private processLayer(layer: Layer): void {
    const existingLayer = this.activeLayers.get(layer.id);

    if (layer.visible) {
      if (!existingLayer) {
        // Crear y cargar datos de la capa
        this.loadAndCreateLayer(layer);
      } else {
        // Actualizar opacidad si cambió
        this.updateLayerOpacity(existingLayer, layer);
      }
    } else {
      if (existingLayer) {
        this.map.removeLayer(existingLayer);
        this.activeLayers.delete(layer.id);
        console.log(`❌ Capa desactivada: ${layer.name}`);
      }
    }
  }

  private async loadAndCreateLayer(layer: Layer): Promise<void> {
    const bounds = this.getMapBounds();

    switch (layer.type) {
      case LayerType.POINT:
        await this.loadPointLayer(layer, bounds);
        break;
      case LayerType.RASTER:
        await this.loadRasterLayer(layer);
        break;
      case LayerType.VECTOR:
        await this.loadVectorLayer(layer, bounds);
        break;
    }
  }

  // ==========================================================================
  // CAPAS DE PUNTOS
  // ==========================================================================

  private async loadPointLayer(layer: Layer, bounds: BoundingBox): Promise<void> {
    const layerGroup = this.L.layerGroup();

    // Determinar qué endpoint usar según la categoría
    let dataObservable: ReturnType<typeof this.mapDataService.getEmas> | null = null;

    switch (layer.category) {
      case LayerCategory.EMAS:
        dataObservable = this.mapDataService.getEmas({ bounds });
        break;
      case LayerCategory.CONVENTIONAL_STATIONS:
        if (layer.id.includes('synop')) {
          dataObservable = this.mapDataService.getSynop({ bounds }) as any;
        } else {
          dataObservable = this.mapDataService.getMetar({ bounds }) as any;
        }
        break;
      default:
        // Crear capa vacía por ahora
        this.activeLayers.set(layer.id, layerGroup);
        layerGroup.addTo(this.map);
        return;
    }

    if (!dataObservable) return;

    dataObservable.pipe(takeUntil(this.destroy$)).subscribe((points: MapPoint<any>[]) => {
      // Limpiar capa existente si existe
      const existing = this.activeLayers.get(layer.id);
      if (existing) {
        this.map.removeLayer(existing);
      }

      // Crear markers
      points.forEach((point: MapPoint<any>) => {
        const marker = this.L.circleMarker([point.coordinates.lat, point.coordinates.lng], {
          radius: 7,
          fillColor: this.getColorForLayer(layer),
          color: '#222',
          weight: 1,
          opacity: 1,
          fillOpacity: layer.opacity / 100,
        });

        const popupContent = this.buildPointPopup(point, layer);
        marker.bindPopup(popupContent);
        marker.addTo(layerGroup);
      });

      layerGroup.addTo(this.map);
      this.activeLayers.set(layer.id, layerGroup);
      console.log(`✅ Capa de puntos cargada: ${layer.name} (${points.length} puntos)`);
    });
  }

  private buildPointPopup(point: MapPoint<any>, layer: Layer): string {
    const data = point.data;
    let content = `<strong>${data.nombre || 'Sin nombre'}</strong>`;

    if (data.provincia) {
      content += `<br><small>${data.provincia}</small>`;
    }

    if (data.temperatura !== undefined) {
      content += `<br>🌡️ ${data.temperatura}°C`;
    }

    if (data.humedad !== undefined) {
      content += `<br>💧 ${data.humedad}%`;
    }

    if (data.viento_velocidad !== undefined) {
      content += `<br>💨 ${data.viento_velocidad} km/h`;
      if (data.viento_direccion !== undefined) {
        content += ` (${data.viento_direccion}°)`;
      }
    }

    if (data.fecha_actualizacion) {
      content += `<br><small>📅 ${data.fecha_actualizacion}</small>`;
    }

    return content;
  }

  // ==========================================================================
  // CAPAS RASTER (Imágenes)
  // ==========================================================================

  private async loadRasterLayer(layer: Layer): Promise<void> {
    // Determinar endpoint según categoría y capa
    let dataObservable;

    switch (layer.category) {
      case LayerCategory.SATELLITE_ABI:
        dataObservable = this.mapDataService.getSatelliteAbi({
          producto: layer.id,
        });
        break;
      case LayerCategory.SATELLITE_GLM:
        dataObservable = this.mapDataService.getSatelliteGlm({
          producto: layer.id,
        });
        break;
      case LayerCategory.RADAR:
        const radarId = layer.id.replace('radar_', '');
        dataObservable = this.mapDataService.getRadarImage(radarId);
        break;
      default:
        // Crear placeholder para capas sin implementar
        this.createPlaceholderRasterLayer(layer);
        return;
    }

    dataObservable.pipe(takeUntil(this.destroy$)).subscribe((rasterData) => {
      if (!rasterData) {
        this.createPlaceholderRasterLayer(layer);
        return;
      }

      // Crear image overlay con los datos reales
      const imageBounds: [[number, number], [number, number]] = [
        [rasterData.bounds.south, rasterData.bounds.west],
        [rasterData.bounds.north, rasterData.bounds.east],
      ];

      const imageOverlay = this.L.imageOverlay(rasterData.imageUrl, imageBounds, {
        opacity: layer.opacity / 100,
      });

      imageOverlay.addTo(this.map);
      this.activeLayers.set(layer.id, imageOverlay);
      console.log(`✅ Capa raster cargada: ${layer.name}`);
    });
  }

  private createPlaceholderRasterLayer(layer: Layer): void {
    // Crear un rectángulo semi-transparente como placeholder
    const bounds = this.map.getBounds();
    const rectangle = this.L.rectangle(
      [
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()],
      ],
      {
        color: this.getColorForLayer(layer),
        weight: 1,
        fillColor: this.getColorForLayer(layer),
        fillOpacity: (layer.opacity / 100) * 0.2,
        dashArray: '5, 5',
      }
    );

    rectangle.bindPopup(
      `<strong>${layer.name}</strong><br><em>Datos no disponibles del backend</em>`
    );
    rectangle.addTo(this.map);
    this.activeLayers.set(layer.id, rectangle);
    console.log(`⚠️ Capa raster placeholder: ${layer.name}`);
  }

  // ==========================================================================
  // CAPAS VECTORIALES
  // ==========================================================================

  private async loadVectorLayer(layer: Layer, bounds: BoundingBox): Promise<void> {
    const layerGroup = this.L.layerGroup();

    // Por ahora solo soportamos viento
    if (layer.category === LayerCategory.EMAS && layer.id.includes('wind')) {
      this.mapDataService
        .getWindVectors({ bounds })
        .pipe(takeUntil(this.destroy$))
        .subscribe((vectorField) => {
          if (!vectorField) {
            this.createPlaceholderVectorLayer(layer);
            return;
          }

          vectorField.vectors.forEach((vector) => {
            const arrow = this.createArrow(
              vector.origin,
              vector.direction,
              vector.magnitude,
              layer
            );
            arrow.addTo(layerGroup);
          });

          layerGroup.addTo(this.map);
          this.activeLayers.set(layer.id, layerGroup);
          console.log(`✅ Capa vectorial cargada: ${layer.name}`);
        });
    } else {
      this.createPlaceholderVectorLayer(layer);
    }
  }

  private createArrow(
    origin: { lat: number; lng: number },
    direction: number,
    magnitude: number,
    layer: Layer
  ): any {
    // Calcular punto final basado en dirección y magnitud
    const length = magnitude * 0.001; // Escalar magnitud
    const radians = (direction * Math.PI) / 180;
    const endLat = origin.lat + length * Math.cos(radians);
    const endLng = origin.lng + length * Math.sin(radians);

    const arrow = this.L.polyline(
      [
        [origin.lat, origin.lng],
        [endLat, endLng],
      ],
      {
        color: this.getColorForLayer(layer),
        weight: 2,
        opacity: layer.opacity / 100,
      }
    );

    // Agregar punta de flecha
    const arrowHead = this.L.circleMarker([endLat, endLng], {
      radius: 3,
      fillColor: this.getColorForLayer(layer),
      color: this.getColorForLayer(layer),
      weight: 1,
      opacity: layer.opacity / 100,
      fillOpacity: layer.opacity / 100,
    });

    const group = this.L.layerGroup([arrow, arrowHead]);
    group.bindPopup(`💨 ${magnitude.toFixed(1)} km/h @ ${direction}°`);
    return group;
  }

  private createPlaceholderVectorLayer(layer: Layer): void {
    const layerGroup = this.L.layerGroup();
    const center = this.map.getCenter();

    // Crear grid de vectores de ejemplo
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const lat = center.lat + i * 0.05;
        const lng = center.lng + j * 0.05;
        const direction = Math.random() * 360;
        const magnitude = 10 + Math.random() * 30;

        const arrow = this.createArrow({ lat, lng }, direction, magnitude, layer);
        arrow.addTo(layerGroup);
      }
    }

    layerGroup.addTo(this.map);
    this.activeLayers.set(layer.id, layerGroup);
    console.log(`⚠️ Capa vectorial placeholder: ${layer.name}`);
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  private loadLayerData(bounds?: BoundingBox): void {
    const currentBounds = bounds || this.getMapBounds();

    // Recargar capas de puntos activas
    this.activeLayers.forEach((_, layerId) => {
      const groups = this.layerService.getLayerGroups();
      for (const group of groups) {
        const layer = this.findLayerById(group.layers, layerId);
        if (layer && layer.visible && layer.type === LayerType.POINT) {
          this.loadPointLayer(layer, currentBounds);
        }
      }
    });
  }

  private findLayerById(layers: Layer[], id: string): Layer | undefined {
    for (const layer of layers) {
      if (layer.id === id) return layer;
      if (layer.sublayers) {
        const found = this.findLayerById(layer.sublayers, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  private getMapBounds(): BoundingBox {
    const bounds = this.map.getBounds();
    return {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };
  }

  private getColorForLayer(layer: Layer): string {
    const colors: Record<string, string> = {
      satellite_abi: '#FF6B6B',
      satellite_glm: '#FFD93D',
      radar: '#6BCF7F',
      emas: '#4ECDC4',
      conventional_stations: '#95E1D3',
      numerical_models: '#A8E6CF',
    };
    return colors[layer.category] || '#2f7bff';
  }

  private updateLayerOpacity(leafletLayer: any, layer: Layer): void {
    const opacity = layer.opacity / 100;

    if (leafletLayer.setOpacity) {
      leafletLayer.setOpacity(opacity);
    } else if (leafletLayer.setStyle) {
      leafletLayer.setStyle({
        opacity: opacity,
        fillOpacity: opacity * 0.5,
      });
    } else if (leafletLayer.eachLayer) {
      leafletLayer.eachLayer((l: any) => {
        if (l.setOpacity) l.setOpacity(opacity);
        if (l.setStyle) {
          l.setStyle({
            opacity: opacity,
            fillOpacity: opacity,
          });
        }
      });
    }
  }

  // ==========================================================================
  // DIBUJO DE POLÍGONOS
  // ==========================================================================

  private setupPolygonHandlers(): void {
    // Escuchar cuando se eliminan polígonos desde el servicio
    this.polygonService
      .onPolygonDeleted()
      .pipe(takeUntil(this.destroy$))
      .subscribe((polygonId) => {
        this.removePolygonFromMap(polygonId);
      });

    // Escuchar cuando se limpian todos los polígonos
    this.polygonService
      .onPolygonsCleared()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.clearAllPolygonsFromMap();
      });
  }

  private async initDrawnItems(): Promise<void> {
    if (!this.drawnItems) {
      this.drawnItems = this.L.featureGroup().addTo(this.map);
    }
  }

  private enableDrawing(): void {
    if (!this.map || !this.L) return;

    this.initDrawnItems();

    // Cancelar cualquier dibujo previo
    this.disableDrawing();

    const mode = this.polygonService.getDrawingMode();
    const color = SMN_COLORS[this.polygonService.getPolygons().length % SMN_COLORS.length];

    // Crear handler de dibujo según el modo
    const drawOptions = {
      shapeOptions: {
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
      },
    };

    switch (mode) {
      case 'polygon':
        this.currentDrawHandler = new this.L.Draw.Polygon(this.map, drawOptions);
        break;
      case 'rectangle':
        this.currentDrawHandler = new this.L.Draw.Rectangle(this.map, drawOptions);
        break;
      case 'circle':
        this.currentDrawHandler = new this.L.Draw.Circle(this.map, drawOptions);
        break;
      default:
        return;
    }

    this.currentDrawHandler.enable();

    // Escuchar evento de creación
    this.map.once(this.L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      this.drawnItems.addLayer(layer);

      // Obtener coordenadas
      let coordinates: [number, number][];
      if (e.layerType === 'circle') {
        // Para círculos, crear un polígono aproximado
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        coordinates = this.circleToPolygon(center, radius);
      } else {
        coordinates = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng]);
      }

      // Calcular área
      const area = this.calculateArea(coordinates);

      // Guardar el ID del layer para poder eliminarlo después
      const polygonCount = this.polygonService.getPolygons().length + 1;

      const polygon = this.polygonService.addPolygon({
        name: `Polígono ${polygonCount}`,
        coordinates,
        area,
        color,
      });

      // Asociar el ID del polígono con el layer
      (layer as any).polygonId = polygon.id;

      // Agregar popup
      layer.bindPopup(`<strong>${polygon.name}</strong><br>Área: ${this.formatArea(area)}`);

      console.log(`🎨 Polygon created: ${polygon.name}`);
    });

    // Escuchar cancelación
    this.map.once(this.L.Draw.Event.DRAWSTOP, () => {
      this.polygonService.stopDrawing();
    });

    console.log(`🎨 Drawing enabled: ${mode}`);
  }

  private disableDrawing(): void {
    if (this.currentDrawHandler) {
      this.currentDrawHandler.disable();
      this.currentDrawHandler = null;
    }
  }

  private removePolygonFromMap(polygonId: string): void {
    if (!this.drawnItems) return;

    this.drawnItems.eachLayer((layer: any) => {
      if (layer.polygonId === polygonId) {
        this.drawnItems.removeLayer(layer);
      }
    });
  }

  private clearAllPolygonsFromMap(): void {
    if (this.drawnItems) {
      this.drawnItems.clearLayers();
    }
  }

  private circleToPolygon(center: any, radius: number, points: number = 32): [number, number][] {
    const coordinates: [number, number][] = [];
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const lat = center.lat + (radius / 111320) * Math.cos(angle);
      const lng =
        center.lng + (radius / (111320 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);
      coordinates.push([lat, lng]);
    }
    coordinates.push(coordinates[0]); // Cerrar el polígono
    return coordinates;
  }

  private calculateArea(coordinates: [number, number][]): number {
    // Fórmula de Shoelace para calcular área en m²
    if (coordinates.length < 3) return 0;

    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n - 1; i++) {
      const [lat1, lng1] = coordinates[i];
      const [lat2, lng2] = coordinates[i + 1];

      // Convertir a metros aproximadamente
      const x1 = lng1 * 111320 * Math.cos((lat1 * Math.PI) / 180);
      const y1 = lat1 * 110540;
      const x2 = lng2 * 111320 * Math.cos((lat2 * Math.PI) / 180);
      const y2 = lat2 * 110540;

      area += x1 * y2 - x2 * y1;
    }

    return Math.abs(area / 2);
  }

  private formatArea(area: number): string {
    if (area > 1000000) {
      return `${(area / 1000000).toFixed(2)} km²`;
    }
    return `${area.toFixed(2)} m²`;
  }
}
