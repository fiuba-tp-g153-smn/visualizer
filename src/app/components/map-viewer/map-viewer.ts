import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as L from 'leaflet';
import { MAP_CONFIG } from '../../config/map.config';
import { TileService } from '../../services/tile.service';
import { LayerService } from '../../services/layer.service';
import { LayerRendererService } from '../../services/layer-renderer.service';
import { Layer, TileProvider } from '../../models';

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
  private tileService = inject(TileService);
  private layerService = inject(LayerService);
  private layerRendererService = inject(LayerRendererService);

  private currentTileLayer: L.TileLayer | null = null;
  private activeLayers = new Map<string, L.TileLayer>();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Effect: cambiar mapa base
      effect(() => {
        const provider = this.tileService.currentProvider();
        if (this.map) {
          this.changeTileProvider(provider);
        }
      });

      // Effect: sincronizar capas satelitales
      effect(() => {
        const layers = this.layerService.activeLayers();
        if (this.map) {
          this.syncLayers(layers);
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
      zoomControl: false, // Desactivar control de zoom por defecto
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

  private changeTileProvider(provider: TileProvider): void {
    if (!this.map) return;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(this.map);

    console.log('✅ Tile provider actualizado:', provider.name);
  }

  /**
   * Sincroniza las capas activas con el mapa
   */
  private syncLayers(layers: Layer[]): void {
    if (!this.map) return;

    const activeIds = new Set(layers.map((l) => l.id));

    // Remover capas que ya no están activas
    for (const [id, tileLayer] of this.activeLayers) {
      if (!activeIds.has(id)) {
        this.map.removeLayer(tileLayer);
        this.activeLayers.delete(id);
      }
    }

    // Agregar/actualizar capas activas
    for (const layer of layers) {
      const existingLayer = this.activeLayers.get(layer.id);

      if (existingLayer) {
        // Actualizar opacidad y zIndex
        existingLayer.setOpacity(layer.opacity / 100);
        existingLayer.setZIndex(layer.zIndex ?? 0);
      } else {
        // Crear nueva capa
        const tileLayer = this.layerRendererService.createTileLayer(layer);
        tileLayer.addTo(this.map);
        this.activeLayers.set(layer.id, tileLayer);
        console.log(`✅ Capa agregada: ${layer.name}`);
      }
    }
  }

  /**
   * Métodos para controles de zoom personalizados
   */
  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  canZoomIn(): boolean {
    if (!this.map) return false;
    return this.map.getZoom() < this.map.getMaxZoom();
  }

  canZoomOut(): boolean {
    if (!this.map) return false;
    return this.map.getZoom() > this.map.getMinZoom();
  }
}
