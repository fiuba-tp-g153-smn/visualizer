import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as L from 'leaflet';
import { MAP_CONFIG } from '../../config/map.config';
import { TileService } from '../../services/tile.service';
import { LayerService } from '../../services/layer.service';
import { LayerRendererService } from '../../services/layer-renderer.service';
import { ChannelConfigService } from '../../services/channel-config.service';
import { Layer, TileProvider, LayerCategory } from '../../models';

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
  private channelConfigService = inject(ChannelConfigService);

  private currentTileLayer: L.TileLayer | null = null;
  // private activeLayers ... replaced by onMapLayers
  // private pendingTransitions ... removed
  // private loadingLayers ... removed

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Effect: cambiar mapa base
      effect(() => {
        const provider = this.tileService.currentProvider();
        if (this.map) {
          this.changeTileProvider(provider);
        }
      });

      // Effect: sincronizar capas satelitales (Reacciona a cambios en capas O en config)
      effect(() => {
        const layers = this.layerService.activeLayers();
        const configCache = this.channelConfigService.configCache(); // Dependencia para reactividad
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
      fadeAnimation: false, // Desactivar fade para evitar flash en transiciones
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

  private onMapLayers = new Map<string, L.TileLayer>();

  private syncLayers(layers: Layer[]): void {
    if (!this.map) return;

    const desiredLayersOnMap = new Map<string, L.TileLayer>();
    const activeKeysForPool = new Set<string>();

    for (const layer of layers) {
      if (!layer.visible) continue;

      const tilesets = this.channelConfigService.getTilesets(layer.id);
      const currentTimeIndex = layer.timeIndex ?? 0;

      // Definir ventana de pre-fetching: [T-1, T, T+1]
      // Si estamos en Mobile o memoria baja, podríamos reducir esto solo a T
      const indicesToLoad = new Set<number>([currentTimeIndex]);
      
      // Agregar vecinos si existen
      if (tilesets.length > 0) {
        if (currentTimeIndex < tilesets.length - 1) indicesToLoad.add(currentTimeIndex + 1);
        if (currentTimeIndex > 0) indicesToLoad.add(currentTimeIndex - 1);
      }

      for (const tIndex of indicesToLoad) {
        // Obtener ID del tileset para la clave única (duplicando lógica simple para consistencia)
        let tilesetId = 'default';
        if (tilesets && tilesets[tIndex]) {
          tilesetId = tilesets[tIndex].id;
        } else if (layer.category === LayerCategory.SATELLITE_ABI) {
             tilesetId = `placeholder-${tIndex}`;
        }
        
        const uniqueKey = `${layer.id}-${tilesetId}`;
        activeKeysForPool.add(uniqueKey);

        // Obtener instancia del pool
        const tileLayer = this.layerRendererService.getTileLayerForTime(layer, tIndex);
        desiredLayersOnMap.set(uniqueKey, tileLayer);

        // Configurar estado visual
        const isTarget = tIndex === currentTimeIndex;
        
        // Z-Index: Mantener orden relativo de capas.
        // Capas ocultas (prefetch) van al fondo para no interferir eventos aunque tengan opacity 0
        if (isTarget) {
            tileLayer.setOpacity(layer.opacity / 100);
            if (layer.zIndex !== undefined) tileLayer.setZIndex(layer.zIndex);
        } else {
            tileLayer.setOpacity(0);
            tileLayer.setZIndex(0);
        }
      }
    }

    // 1. Remover capas que ya no son deseadas
    for (const [key, layer] of this.onMapLayers) {
      if (!desiredLayersOnMap.has(key)) {
        this.map.removeLayer(layer);
      }
    }

    // 2. Agregar nuevas capas
    for (const [key, layer] of desiredLayersOnMap) {
      if (!this.onMapLayers.has(key)) {
        layer.addTo(this.map!);
      }
    }

    // Actualizar estado local
    this.onMapLayers = desiredLayersOnMap;

    // 3. Limpiar pool global de capas que ya no usamos
    // Importante: No limpiamos inmediatamente si saltamos lejos, para dar chance al GC natural o LRU futuro.
    // Pero por diseño actual, "prune" es explícito.
    this.layerRendererService.prunePool(activeKeysForPool);
  }

  // Métodos antiguos de transición eliminados en favor de pre-fetching simple

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
