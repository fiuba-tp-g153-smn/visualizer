import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import { MAP_CONFIG } from '../config/map.config';
import { TileService } from '../services/tile.service';
import { TileProvider } from '../config/tile-providers.config';

@Component({
  selector: 'app-map-viewer',
  standalone: true,
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
})
export class MapViewer implements OnInit, OnDestroy {
  private map: L.Map | null = null;
  private platformId = inject(PLATFORM_ID);
  private tileService = inject(TileService);

  // Referencia al tile layer actual para poder cambiarlo
  private currentTileLayer: L.TileLayer | null = null;

  constructor() {
    // Effect para escuchar cambios en el tile provider (reactivo)
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const provider = this.tileService.currentProvider();
        if (this.map) {
          this.changeTileProvider(provider);
        }
      });
    }
  }

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
    // Crear el mapa con configuración centralizada
    this.map = L.map('map', {
      center: [MAP_CONFIG.initialCenter.lat, MAP_CONFIG.initialCenter.lng],
      zoom: MAP_CONFIG.initialZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
    });

    // Obtener el proveedor inicial del servicio
    const initialProvider = this.tileService.getCurrentProvider();

    // Agregar tile layer inicial
    this.currentTileLayer = L.tileLayer(initialProvider.url, {
      attribution: initialProvider.attribution,
      maxZoom: initialProvider.maxZoom,
    }).addTo(this.map);

    console.log('🗺️ Mapa inicializado correctamente');
    console.log(`📍 Centro: ${MAP_CONFIG.initialCenter.lat}, ${MAP_CONFIG.initialCenter.lng}`);
    console.log(`🔍 Zoom: ${MAP_CONFIG.initialZoom}`);
    console.log(`🗺️ Tiles: ${initialProvider.name}`);
  }

  /**
   * Cambia el proveedor de tiles del mapa
   */
  private changeTileProvider(provider: TileProvider): void {
    if (!this.map) return;

    // Remover el tile layer anterior si existe
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    // Crear y agregar el nuevo tile layer
    this.currentTileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(this.map);

    console.log('✅ Tile provider actualizado:', provider.name);
  }
}
