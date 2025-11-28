import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MapDataService, Point, EmaData } from '../services/map-data.service';
import { LayerService, Layer, LayerType } from '../services/layer.service';
import { TileService } from '../services/tile.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
})
export class MapViewer implements OnInit, OnDestroy {
  private map: any = null;
  private platformId = inject(PLATFORM_ID);
  private layerService = inject(LayerService);
  private tileService = inject(TileService);
  private pointsLayer: any = null;
  private activeLayers = new Map<string, any>(); // Mapa de ID de capa -> Leaflet layer
  private currentTileLayer: any = null; // Referencia al tile layer actual
  private subscriptions: Subscription = new Subscription();
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor(private mapDataService: MapDataService) {
    // Efecto para escuchar cambios en las capas
    if (this.isBrowser) {
      effect(() => {
        const groups = this.layerService.getLayerGroups();
        // Ensure groups is an array before processing
        if (this.map && Array.isArray(groups)) {
          this.updateMapLayers(groups);
        }
      });

      // Efecto para escuchar cambios en el tile provider
      effect(() => {
        const provider = this.tileService.getCurrentProvider()();
        if (this.map && provider) {
          this.changeTileProvider(provider);
        }
      });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.subscriptions.unsubscribe();
  }

  private async initMap(): Promise<void> {
    if (!this.isBrowser) return;
    
    const L = await import('leaflet').then((m) => m.default || m);

    this.map = L.map('map', {
      center: [-34.6037, -58.3816], // Starting point: CABA
      zoom: 12,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
    });

    // Add zoom control in bottom left position
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    // Default tile layer - ArgenMAP (IGN Argentina)
    this.currentTileLayer = L.tileLayer(
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
      {
        attribution:
          '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
      }
    ).addTo(this.map);

    // Cargar datos iniciales de EMAs
    this.loadPointsBasedOnBounds();
    this.map.on('moveend', () => {
      this.loadPointsBasedOnBounds();
    });
  }

  private async changeTileProvider(provider: any): Promise<void> {
    if (!this.map || !this.isBrowser) return;

    const L = await import('leaflet').then((m) => m.default || m);

    // Remover el tile layer actual
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    // Agregar el nuevo tile layer
    this.currentTileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(this.map);

    console.log('🗺️ Map tile provider updated to:', provider.name);
  }

  private async updateMapLayers(groups: any[]): Promise<void> {
    if (!this.map || !this.isBrowser || !Array.isArray(groups)) return;

    const L = await import('leaflet').then((m) => m.default || m);

    // Iterar sobre todos los grupos y capas
    groups.forEach((group) => {
      if (Array.isArray(group.layers)) {
        group.layers.forEach((layer: Layer) => {
          this.processLayer(layer, L);

          // Procesar subcapas si existen
          if (layer.sublayers && Array.isArray(layer.sublayers)) {
            layer.sublayers.forEach((sublayer) => this.processLayer(sublayer, L));
          }
        });
      }
    });
  }

  private processLayer(layer: Layer, L: any): void {
    const existingLayer = this.activeLayers.get(layer.id);

    if (layer.visible) {
      if (!existingLayer) {
        // Crear nueva capa según el tipo
        const newLayer = this.createLayerByType(layer, L);
        if (newLayer) {
          newLayer.addTo(this.map);
          this.activeLayers.set(layer.id, newLayer);
          console.log(`✅ Capa activada: ${layer.name}`);
        }
      } else {
        // Actualizar opacidad si cambió
        this.updateLayerOpacity(existingLayer, layer);
      }
    } else {
      if (existingLayer) {
        // Remover capa
        this.map.removeLayer(existingLayer);
        this.activeLayers.delete(layer.id);
        console.log(`❌ Capa desactivada: ${layer.name}`);
      }
    }
  }

  private createLayerByType(layer: Layer, L: any): any {
    // Mock: Crear capas visuales según el tipo
    switch (layer.type) {
      case LayerType.POINT:
        return this.createMockPointLayer(layer, L);
      case LayerType.RASTER:
        return this.createMockRasterLayer(layer, L);
      case LayerType.VECTOR:
        return this.createMockVectorLayer(layer, L);
      default:
        return null;
    }
  }

  private createMockPointLayer(layer: Layer, L: any): any {
    if (!this.map || !this.isBrowser) return null;
    
    // Crear un layer group con puntos de ejemplo
    const layerGroup = L.layerGroup();
    const center = this.map.getCenter();

    // Crear 5 puntos aleatorios alrededor del centro
    for (let i = 0; i < 5; i++) {
      const lat = center.lat + (Math.random() - 0.5) * 0.1;
      const lng = center.lng + (Math.random() - 0.5) * 0.1;

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: this.getColorForLayer(layer),
        color: '#222',
        weight: 2,
        opacity: 1,
        fillOpacity: layer.opacity / 100,
      });

      marker.bindPopup(`<strong>${layer.name}</strong><br>Punto de ejemplo ${i + 1}`);
      marker.addTo(layerGroup);
    }

    return layerGroup;
  }

  private createMockRasterLayer(layer: Layer, L: any): any {
    if (!this.map || !this.isBrowser) return null;
    
    // Mock: Crear un rectángulo con gradiente para simular imagen raster
    const bounds = this.map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // Crear un rectángulo semi-transparente
    const rectangle = L.rectangle(
      [
        [sw.lat, sw.lng],
        [ne.lat, ne.lng],
      ],
      {
        color: this.getColorForLayer(layer),
        weight: 2,
        fillColor: this.getColorForLayer(layer),
        fillOpacity: (layer.opacity / 100) * 0.3,
      }
    );

    rectangle.bindPopup(`<strong>${layer.name}</strong><br>Capa raster simulada`);
    return rectangle;
  }

  private createMockVectorLayer(layer: Layer, L: any): any {
    if (!this.map || !this.isBrowser) return null;
    
    // Mock: Crear flechas para simular campo vectorial
    const layerGroup = L.layerGroup();
    const center = this.map.getCenter();

    // Crear grid de vectores
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const lat = center.lat + i * 0.05;
        const lng = center.lng + j * 0.05;
        const endLat = lat + 0.02;
        const endLng = lng + 0.02;

        const arrow = L.polyline(
          [
            [lat, lng],
            [endLat, endLng],
          ],
          {
            color: this.getColorForLayer(layer),
            weight: 2,
            opacity: layer.opacity / 100,
          }
        );

        // Agregar punta de flecha
        const arrowHead = L.circleMarker([endLat, endLng], {
          radius: 4,
          fillColor: this.getColorForLayer(layer),
          color: this.getColorForLayer(layer),
          weight: 1,
          opacity: layer.opacity / 100,
          fillOpacity: layer.opacity / 100,
        });

        arrow.addTo(layerGroup);
        arrowHead.addTo(layerGroup);
      }
    }

    layerGroup.bindPopup(`<strong>${layer.name}</strong><br>Campo vectorial simulado`);
    return layerGroup;
  }

  private getColorForLayer(layer: Layer): string {
    // Colores según categoría
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
        fillOpacity: opacity * 0.3,
      });
    } else if (leafletLayer.eachLayer) {
      // Para layer groups
      leafletLayer.eachLayer((l: any) => {
        if (l.setOpacity) l.setOpacity(opacity);
        if (l.setStyle)
          l.setStyle({
            opacity: opacity,
            fillOpacity: opacity,
          });
      });
    }
  }

  private loadPointsBasedOnBounds(): void {
    // Ensure we only run this in browser environment
    if (!this.map || !this.isBrowser) return;
    
    const bounds = this.map.getBounds();
    const params = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    this.subscriptions.add(
      this.mapDataService.getPoints('emas', params).subscribe((points: Point<EmaData>[]) => {
        this.addPointsToMap(points);
      })
    );
  }

  private async addPointsToMap(points: Point<EmaData>[]): Promise<void> {
    if (!this.map || !this.isBrowser || !Array.isArray(points)) return;
    
    const L = await import('leaflet').then((m) => m.default || m);

    if (this.pointsLayer) {
      this.map.removeLayer(this.pointsLayer);
    }

    this.pointsLayer = L.layerGroup();

    points.forEach((point: Point<EmaData>) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 7,
        fillColor: '#2f7bff',
        color: '#222',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9,
      });

      const name = point.data?.name ?? '';
      const description = point.data?.description ?? '';
      const temp = point.data?.temperature;

      let popupContent = `<strong>${name}</strong>`;
      if (description) popupContent += `<br>${description}`;
      if (temp !== undefined) popupContent += `<br>Temperatura: ${temp} °C`;

      marker.bindPopup(popupContent);
      this.pointsLayer.addLayer(marker);
    });

    this.pointsLayer.addTo(this.map);
  }
}
