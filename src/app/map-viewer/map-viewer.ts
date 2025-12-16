import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MapDataService } from '../services/map-data.service';
import {
  LayerService,
  Layer,
  LayerType,
  LayerCategory,
  ActiveLayer,
} from '../services/layer.service';
import { TileService } from '../services/tile.service';
import { PolygonService, DrawnPolygon } from '../services/polygon.service';
import { UiService } from '../services/ui.service';
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
  private uiService = inject(UiService);

  // Capas activas en el mapa (id -> leaflet layer)
  private activeLayers = new Map<string, any>();
  private currentTileLayer: any = null;

  // Polígonos dibujados
  private drawnItems: any = null;
  private drawControl: any = null;
  private currentDrawHandler: any = null;

  // Referencia global a Leaflet Draw
  private LDraw: any = null;

  // Control de suscripciones y eventos
  private destroy$ = new Subject<void>();
  private mapMove$ = new Subject<BoundingBox>();

  // Flag para evitar recargas innecesarias del tile layer
  private lastTileProviderId: string | null = null;

  // Almacena el último forecastHour usado por cada capa WRF
  private lastForecastHours = new Map<string, number>();

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

      // Efecto para escuchar cambios en el orden de las capas activas
      effect(() => {
        const activeLayers = this.layerService.activeLayers();
        if (this.map && this.L) {
          this.updateLayerZIndexes(activeLayers);
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
    const leaflet = await import('leaflet');
    this.L = leaflet.default || leaflet;

    // Importar leaflet-draw (extiende L automáticamente)
    const leafletDraw = await import('leaflet-draw');
    // leaflet-draw extiende el objeto global L, así que usamos window.L o this.L.Draw
    this.LDraw = (window as any).L?.Draw || this.L.Draw || leafletDraw;

    this.map = this.L.map('map', {
      center: [-40.0, -64.0], // Centro de Argentina
      zoom: 4,
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
      group.subgroups.forEach((subgroup: any) => {
        subgroup.layers.forEach((layer: Layer) => {
          this.processLayer(layer);
        });
      });
    });
  }

  // Actualizar z-index de las capas según el orden en activeLayers
  private updateLayerZIndexes(activeLayers: ActiveLayer[]): void {
    if (!this.map || !this.L) return;

    // El z-index base para capas de overlay es 400 en Leaflet
    const baseZIndex = 400;

    activeLayers.forEach((activeLayer, index) => {
      const leafletLayer = this.activeLayers.get(activeLayer.id);
      if (leafletLayer) {
        // El primero en la lista tiene mayor z-index (está adelante)
        const zIndex = baseZIndex + (activeLayers.length - index);

        // Diferentes tipos de capas tienen diferentes métodos para setear z-index
        if (leafletLayer.setZIndex) {
          leafletLayer.setZIndex(zIndex);
        } else if (leafletLayer.eachLayer) {
          // Para LayerGroups, aplicar a cada capa interna
          leafletLayer.eachLayer((sublayer: any) => {
            if (sublayer.setZIndex) {
              sublayer.setZIndex(zIndex);
            } else if (sublayer._icon) {
              // Para markers
              sublayer._icon.style.zIndex = zIndex;
            }
          });
        }

        // Para image overlays (raster layers)
        if (leafletLayer._image) {
          leafletLayer._image.style.zIndex = zIndex;
        }
      }
    });
  }

  private processLayer(layer: Layer): void {
    const existingLayer = this.activeLayers.get(layer.id);

    if (layer.visible) {
      // Verificar si cambió el forecast hour para capas WRF
      const isWrfLayer = layer.id.startsWith('wrf_');
      const currentForecastHour = layer.selectedForecastHour;
      const lastForecastHour = this.lastForecastHours.get(layer.id);
      const forecastChanged = isWrfLayer && currentForecastHour !== lastForecastHour;

      if (!existingLayer || forecastChanged) {
        // Si cambió el forecast, remover la capa anterior
        if (existingLayer && forecastChanged) {
          this.map.removeLayer(existingLayer);
          this.activeLayers.delete(layer.id);
          console.log(`🔄 Cambiando plazo de ${layer.name} a +${currentForecastHour}h`);
        }
        // Crear y cargar datos de la capa
        this.loadAndCreateLayer(layer);
        // Guardar el forecast hour usado
        if (isWrfLayer && currentForecastHour) {
          this.lastForecastHours.set(layer.id, currentForecastHour);
        }
      } else {
        // Actualizar opacidad si cambió
        this.updateLayerOpacity(existingLayer, layer);
      }
    } else {
      if (existingLayer) {
        this.map.removeLayer(existingLayer);
        this.activeLayers.delete(layer.id);
        this.lastForecastHours.delete(layer.id);
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
    // Caso especial: ECMWF Precipitation (datos locales)
    if (layer.id === 'ecmwf_precipitation') {
      this.loadEcmwfPrecipitationLayer(layer);
      return;
    }

    // Caso especial: Capas WRF-SMN (datos locales)
    if (layer.id.startsWith('wrf_')) {
      this.loadWrfLayer(layer);
      return;
    }

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

  /**
   * Carga la capa de precipitación ECMWF desde archivos locales
   */
  private loadEcmwfPrecipitationLayer(layer: Layer): void {
    // Bounds de Argentina (desde overlay_bounds.json)
    const imageBounds: [[number, number], [number, number]] = [
      [-55.0, -74.0], // [south, west]
      [-21.0, -53.0], // [north, east]
    ];

    const imageOverlay = this.L.imageOverlay('/precipitation_overlay.png', imageBounds, {
      opacity: layer.opacity / 100,
      interactive: true,
    });

    imageOverlay.bindPopup(
      `<strong>${layer.name}</strong><br>
       <small>Pronóstico ECMWF Open Data</small><br>
       <small>Precipitación Total 24h</small><br>
       <small>Región: Argentina</small>`
    );

    imageOverlay.addTo(this.map);
    this.activeLayers.set(layer.id, imageOverlay);
    console.log('🌧️ Capa ECMWF Precipitation cargada con datos reales');
  }

  /**
   * Carga capas WRF-SMN desde archivos locales
   * Soporta múltiples plazos de pronóstico
   */
  private loadWrfLayer(layer: Layer): void {
    // Mapeo de IDs a prefijos de archivo
    const layerPrefixMap: Record<string, string> = {
      wrf_precipitation: 'wrf_pp',
      wrf_wind: 'wrf_wind',
      wrf_temperature: 'wrf_t2m',
      wrf_pressure: 'wrf_psfc',
    };

    const prefix = layerPrefixMap[layer.id];
    if (!prefix) {
      this.createPlaceholderRasterLayer(layer);
      return;
    }

    // Obtener el plazo seleccionado (por defecto 24h)
    const leadTime = layer.selectedForecastHour || 24;

    // Buscar y cargar la imagen
    this.findAndLoadWrfImage(layer, prefix, leadTime);
  }

  /**
   * Busca y carga la imagen WRF más reciente
   */
  private async findAndLoadWrfImage(layer: Layer, prefix: string, leadTime: number): Promise<void> {
    // WRF bounds (dominio completo del modelo)
    const wrfBounds: [[number, number], [number, number]] = [
      [-56.85, -94.33], // [south, west]
      [-11.65, -35.67], // [north, east]
    ];

    // Formatear leadTime con 3 dígitos (006, 012, 024, 048, 072)
    const leadTimeStr = leadTime.toString().padStart(3, '0');

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const metadataDate = `${yyyy}${mm}${dd}`;
    console.log('📅 Usando fecha de metadatos WRF:', metadataDate);

    // Intentar cargar el JSON de metadatos primero para obtener bounds exactos
    try {
      const response = await fetch(`/wrf/${prefix}_${metadataDate}_12_${leadTimeStr}.json`);
      if (response.ok) {
        const metadata = await response.json();
        if (metadata.bounds) {
          wrfBounds[0] = [metadata.bounds.south, metadata.bounds.west];
          wrfBounds[1] = [metadata.bounds.north, metadata.bounds.east];
        }
      }
    } catch (e) {
      console.log('Usando bounds por defecto para WRF');
    }

    // Cargar la imagen
    const imageUrl = `/wrf/${prefix}_${metadataDate}_12_${leadTimeStr}.png`;

    try {
      const imgResponse = await fetch(imageUrl, { method: 'GET' });
      if (!imgResponse.ok) {
        return;
      }
    } catch (e) {
      console.log('Imagen WRF no encontrada:', imageUrl);
      return;
    }

    const imageOverlay = this.L.imageOverlay(imageUrl, wrfBounds, {
      opacity: layer.opacity / 100,
      interactive: true,
    });

    // Información según el tipo de capa
    const layerInfo: Record<string, { emoji: string; unit: string; description: string }> = {
      wrf_precipitation: { emoji: '🌧️', unit: 'mm', description: 'Precipitación acumulada' },
      wrf_wind: { emoji: '💨', unit: 'km/h', description: 'Magnitud del viento a 10m' },
      wrf_temperature: { emoji: '🌡️', unit: '°C', description: 'Temperatura a 2m' },
      wrf_pressure: { emoji: '📊', unit: 'hPa', description: 'Presión en superficie' },
    };

    const info = layerInfo[layer.id] || { emoji: '📍', unit: '', description: '' };

    imageOverlay.bindPopup(
      `<strong>${info.emoji} ${layer.name}</strong><br>
       <small>${info.description}</small><br>
       <small>Pronóstico +${leadTime}h</small><br>
       <small>Modelo: WRF-SMN 4km</small>`
    );

    imageOverlay.addTo(this.map);
    this.activeLayers.set(layer.id, imageOverlay);
    console.log(`${info.emoji} Capa ${layer.name} cargada (+${leadTime}h)`);
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
      const layer = this.layerService.getLayerById(layerId);
      if (layer && layer.visible && layer.type === LayerType.POINT) {
        this.loadPointLayer(layer, currentBounds);
      }
    });
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

    // Escuchar zoom a polígono
    this.polygonService
      .onZoomToPolygon()
      .pipe(takeUntil(this.destroy$))
      .subscribe((polygonId) => {
        this.zoomToPolygonOnMap(polygonId);
      });

    // Escuchar inicio de edición de vértices
    this.polygonService
      .onEditingStarted()
      .pipe(takeUntil(this.destroy$))
      .subscribe((polygonId) => {
        this.enablePolygonEditing(polygonId);
      });

    // Escuchar fin de edición de vértices
    this.polygonService
      .onEditingStopped()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.disablePolygonEditing();
      });

    // Escuchar cambios de color/propiedades
    this.polygonService
      .onPolygonUpdated()
      .pipe(takeUntil(this.destroy$))
      .subscribe((polygon) => {
        this.updatePolygonFromService(polygon);
      });
  }

  private async initDrawnItems(): Promise<void> {
    if (!this.drawnItems) {
      // Crear pane para polígonos con z-index alto (siempre encima de las capas)
      if (!this.map.getPane('polygonsPane')) {
        this.map.createPane('polygonsPane');
        this.map.getPane('polygonsPane')!.style.zIndex = '650';
      }
      this.drawnItems = this.L.featureGroup([], { pane: 'polygonsPane' }).addTo(this.map);
    }
  }

  private enableDrawing(): void {
    if (!this.map || !this.L || !this.LDraw) {
      console.error('Map, Leaflet or Leaflet Draw not initialized');
      return;
    }

    this.initDrawnItems();

    // Cancelar cualquier dibujo previo
    this.disableDrawing();

    const color = SMN_COLORS[this.polygonService.polygons().length % SMN_COLORS.length];

    // Crear handler de dibujo para polígono
    const drawOptions = {
      shapeOptions: {
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
      },
    };

    try {
      this.currentDrawHandler = new this.LDraw.Polygon(this.map, drawOptions);
      this.currentDrawHandler.enable();

      // Escuchar evento de creación
      const drawCreatedEvent = this.LDraw.Event?.CREATED || 'draw:created';
      this.map.once(drawCreatedEvent, (e: any) => {
        const layer = e.layer;
        this.drawnItems.addLayer(layer);

        // Obtener coordenadas
        const coordinates = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng]);

        // Calcular área
        const area = this.calculateArea(coordinates);

        // Crear polígono
        const polygonCount = this.polygonService.polygons().length + 1;
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

        // Click handler para abrir el panel de polígonos
        layer.on('click', () => {
          this.uiService.openPolygonPanelWithSelection(polygon.id);
        });

        console.log(`🎨 Polygon created: ${polygon.name}`);
      });

      // Escuchar cancelación
      const drawStopEvent = this.LDraw.Event?.DRAWSTOP || 'draw:drawstop';
      this.map.once(drawStopEvent, () => {
        this.polygonService.stopDrawing();
      });

      console.log('🎨 Drawing enabled');
    } catch (error) {
      console.error('Error enabling drawing:', error);
      this.polygonService.stopDrawing();
    }
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

  private calculateArea(coordinates: [number, number][]): number {
    // Fórmula geodésica para calcular área en m² (aproximación esférica)
    if (coordinates.length < 3) return 0;

    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const EARTH_RADIUS = 6371000; // Radio de la Tierra en metros

    let area = 0;
    const n = coordinates.length;

    // Usar fórmula de área esférica (Girard's theorem simplificado)
    for (let i = 0; i < n; i++) {
      const [lat1, lng1] = coordinates[i];
      const [lat2, lng2] = coordinates[(i + 1) % n]; // Cerrar el polígono

      const phi1 = toRadians(lat1);
      const phi2 = toRadians(lat2);
      const deltaLambda = toRadians(lng2 - lng1);

      area += deltaLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
    }

    area = (area * EARTH_RADIUS * EARTH_RADIUS) / 2;

    return Math.abs(area);
  }

  private formatArea(area: number): string {
    if (area > 10000) {
      return `${(area / 1000000).toFixed(2)} km²`;
    }
    return `${Math.round(area)} m²`;
  }

  private zoomToPolygonOnMap(polygonId: string): void {
    if (!this.drawnItems || !this.map) return;

    this.drawnItems.eachLayer((layer: any) => {
      if (layer.polygonId === polygonId) {
        if (layer.getBounds) {
          this.map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }
      }
    });
  }

  private enablePolygonEditing(polygonId: string): void {
    if (!this.drawnItems || !this.map) return;

    this.drawnItems.eachLayer((layer: any) => {
      if (layer.polygonId === polygonId && layer.editing) {
        layer.editing.enable();

        // Highlight del polígono en edición
        layer.setStyle({
          weight: 3,
          dashArray: '5, 10',
        });

        console.log('✏️ Polygon editing enabled:', polygonId);
      }
    });

    // Escuchar cambios en los vértices
    this.map.on('draw:editvertex', this.onVertexEdited.bind(this));
  }

  private disablePolygonEditing(): void {
    if (!this.drawnItems || !this.map) return;

    // Guardar cambios y deshabilitar edición
    this.drawnItems.eachLayer((layer: any) => {
      if (layer.editing && layer.editing.enabled()) {
        // Obtener nuevas coordenadas
        const coordinates = layer.getLatLngs()[0].map((latlng: any) => [latlng.lat, latlng.lng]);
        const area = this.calculateArea(coordinates);

        // Actualizar en el servicio
        if (layer.polygonId) {
          this.polygonService.updatePolygon(layer.polygonId, coordinates, area);

          // Actualizar popup
          const polygon = this.polygonService.polygons().find((p) => p.id === layer.polygonId);
          if (polygon) {
            layer.setPopupContent(
              `<strong>${polygon.name}</strong><br>Área: ${this.formatArea(area)}`
            );
          }
        }

        layer.editing.disable();

        // Restaurar estilo normal
        layer.setStyle({
          weight: 2,
          dashArray: null,
        });
      }
    });

    // Remover listener
    this.map.off('draw:editvertex');

    console.log('✏️ Polygon editing disabled');
  }

  private onVertexEdited(e: any): void {
    // Se llama cada vez que se mueve un vértice
    // Los cambios finales se guardan en disablePolygonEditing
  }

  private updatePolygonFromService(polygon: DrawnPolygon): void {
    if (!this.drawnItems) return;

    this.drawnItems.eachLayer((layer: any) => {
      if (layer.polygonId === polygon.id) {
        // Actualizar popup con nombre actualizado
        const area = polygon.area || 0;
        layer.bindPopup(`<strong>${polygon.name}</strong><br>Área: ${this.formatArea(area)}`);

        // Actualizar visibilidad y estilo
        if (polygon.visible) {
          layer.setStyle({
            color: polygon.color,
            fillColor: polygon.color,
            fillOpacity: (polygon.opacity / 100) * 0.5,
            opacity: polygon.opacity / 100,
          });
          if (!this.map.hasLayer(layer)) {
            this.drawnItems.addLayer(layer);
          }
        } else {
          layer.setStyle({ opacity: 0, fillOpacity: 0 });
        }
      }
    });
  }
}
