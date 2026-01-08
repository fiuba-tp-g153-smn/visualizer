import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MAP_CONFIG } from '../config/map.config';
import { getTileProvider } from '../config/tile-providers.config';

@Component({
  selector: 'app-map-viewer',
  imports: [],
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
})
export class MapViewer implements OnInit, OnDestroy {
  private map: any = null;
  private L: any = null;
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private async initMap(): Promise<void> {
    // Importar Leaflet dinámicamente
    const leaflet = await import('leaflet');
    this.L = leaflet.default || leaflet;

    // Crear el mapa con configuración centralizada
    this.map = this.L.map('map', {
      center: [MAP_CONFIG.initialCenter.lat, MAP_CONFIG.initialCenter.lng],
      zoom: MAP_CONFIG.initialZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
    });

    // Obtener el proveedor de tiles por defecto
    const defaultProvider = getTileProvider(MAP_CONFIG.defaultTileProviderId);

    // Agregar tile layer
    this.L.tileLayer(defaultProvider.url, {
      attribution: defaultProvider.attribution,
      maxZoom: defaultProvider.maxZoom,
    }).addTo(this.map);

    console.log('🗺️ Mapa inicializado correctamente');
    console.log(`📍 Centro: ${MAP_CONFIG.initialCenter.lat}, ${MAP_CONFIG.initialCenter.lng}`);
    console.log(`🔍 Zoom: ${MAP_CONFIG.initialZoom}`);
    console.log(`🗺️ Tiles: ${defaultProvider.name}`);
  }
}
