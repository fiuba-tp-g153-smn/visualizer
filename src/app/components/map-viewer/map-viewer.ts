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
  private pendingTransitions = new Map<string, number>();
  private loadingLayers = new Map<string, L.TileLayer>();

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
    this.pendingTransitions.forEach((timeoutId) => clearTimeout(timeoutId));
    this.pendingTransitions.clear();
    // Limpiar capas en carga
    this.loadingLayers.forEach((layer) => layer.remove());
    this.loadingLayers.clear();

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
    });

    const initialProvider = this.tileService.getCurrentProvider();

    this.currentTileLayer = L.tileLayer(initialProvider.url, {
      attribution: initialProvider.attribution,
      maxZoom: initialProvider.maxZoom,
      zIndex: 0,
    }).addTo(this.map);
  }

  private changeTileProvider(provider: TileProvider): void {
    if (!this.map) return;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
      zIndex: 0,
    }).addTo(this.map);
  }

  private syncLayers(layers: Layer[]): void {
    if (!this.map) return;

    const activeIds = new Set(layers.map((l) => l.id));

    // Cleanup removidas
    for (const [id, tileLayer] of this.activeLayers) {
      if (!activeIds.has(id)) {
        this.clearPendingTransition(id);
        this.map.removeLayer(tileLayer);
        this.activeLayers.delete(id);
      }
    }

    for (const layer of layers) {
      const existingLayer = this.activeLayers.get(layer.id);

      if (existingLayer) {
        const currentTimeIndex = (existingLayer as any)._timeIndex ?? 0;
        const layerTimeIndex = layer.timeIndex ?? 0;
        const hasTimeIndexChanged = currentTimeIndex !== layerTimeIndex;

        if (hasTimeIndexChanged) {
          // Si ya estamos cargando algo para esta capa, cancelar esa carga anterior
          this.clearPendingTransition(layer.id);

          const newTileLayer = this.layerRendererService.createTileLayer(layer);
          (newTileLayer as any)._timeIndex = layerTimeIndex;
          newTileLayer.setOpacity(0);
          newTileLayer.addTo(this.map);

          // Guardar referencia
          this.loadingLayers.set(layer.id, newTileLayer);

          // Función para completar la transición
          const completeTransition = () => {
            if (!this.map) return;

            // 1. Mostrar nueva capa
            if (this.map.hasLayer(newTileLayer)) {
              newTileLayer.setOpacity(layer.opacity / 100);
            }

            // 2. Remover capa vieja
            if (existingLayer && this.map.hasLayer(existingLayer)) {
              this.map.removeLayer(existingLayer);
            }

            // 3. Actualizar estado
            this.activeLayers.set(layer.id, newTileLayer);
            this.loadingLayers.delete(layer.id);
            this.pendingTransitions.delete(layer.id);
          };

          // A: Escuchar evento load (ÉXITO)
          newTileLayer.on('load', () => {
             // Verificar que esta sea la transición vigente
             if (this.loadingLayers.get(layer.id) === newTileLayer) {
                // Cancelar timeout de seguridad
                const timeoutId = this.pendingTransitions.get(layer.id);
                if (timeoutId) clearTimeout(timeoutId);
                completeTransition();
             }
          });

          // B: Timeout de seguridad (FALLBACK) - 8 segundos
          // Si la imagen falla o tarda mucho, forzamos el cambio para no dejar la UI inconsistente eternamente
          const safetyTimeoutId = window.setTimeout(() => {
             console.warn(`⚠️ [MapViewer] Timeout de carga para capa ${layer.id}, forzando transición.`);
             if (this.loadingLayers.get(layer.id) === newTileLayer) {
                completeTransition();
             }
          }, 8000);

          this.pendingTransitions.set(layer.id, safetyTimeoutId);

        } else {
          // Solo actualizar propiedades visuales si es la misma capa/tiempo
          existingLayer.setOpacity(layer.opacity / 100);
          if (layer.zIndex !== undefined) {
            existingLayer.setZIndex(layer.zIndex);
          }
        }
      } else {
        // Primera vez que se agrega la capa
        const tileLayer = this.layerRendererService.createTileLayer(layer);
        (tileLayer as any)._timeIndex = layer.timeIndex ?? 0;
        tileLayer.addTo(this.map);
        this.activeLayers.set(layer.id, tileLayer);
      }
    }
  }

  private clearPendingTransition(layerId: string): void {
    // 1. Cancelar timeout
    const timeoutId = this.pendingTransitions.get(layerId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pendingTransitions.delete(layerId);
    }

    // 2. Remover capa en carga si existe (para evitar leak)
    const loadingLayer = this.loadingLayers.get(layerId);
    if (loadingLayer) {
      if (this.map && this.map.hasLayer(loadingLayer)) {
        this.map.removeLayer(loadingLayer);
      }
      this.loadingLayers.delete(layerId);
    }
  }

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

  getCurrentZoom(): number {
    return this.map?.getZoom() ?? MAP_CONFIG.initialZoom;
  }
}
