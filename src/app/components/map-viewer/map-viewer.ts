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

    for (const [id, tileLayer] of this.activeLayers) {
      if (!activeIds.has(id)) {
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
          this.map.removeLayer(existingLayer);
          this.activeLayers.delete(layer.id);

          const tileLayer = this.layerRendererService.createTileLayer(layer);
          (tileLayer as any)._timeIndex = layerTimeIndex;
          tileLayer.addTo(this.map);
          this.activeLayers.set(layer.id, tileLayer);
        } else {
          existingLayer.setOpacity(layer.opacity / 100);
          if (layer.zIndex !== undefined) {
            existingLayer.setZIndex(layer.zIndex);
          }
        }
      } else {
        const tileLayer = this.layerRendererService.createTileLayer(layer);
        (tileLayer as any)._timeIndex = layer.timeIndex ?? 0;
        tileLayer.addTo(this.map);
        this.activeLayers.set(layer.id, tileLayer);
      }
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
