/**
 * EJEMPLO DE USO DEL SERVICIO DE TILES SATELITALES
 *
 * Este archivo muestra cómo consumir el tile server desde el frontend Angular.
 * Puedes copiar y adaptar este código en tu componente de mapa.
 */

import { Component, OnInit, inject } from '@angular/core';
import { SatelliteTilesService } from '../services/satellite-tiles.service';
import { TileLayerData, TileProduct } from '../models/map-data.models';

// Ejemplo 1: Usar en un componente con Leaflet
// ============================================

/*
import * as L from 'leaflet';

@Component({
  selector: 'app-satellite-map',
  template: `
    <div id="map" style="height: 600px;"></div>
    <button (click)="toggleAshRgbLayer()">Toggle ASH RGB</button>
  `,
})
export class SatelliteMapComponent implements OnInit {
  private satelliteTilesService = inject(SatelliteTilesService);
  private map!: L.Map;
  private ashRgbLayer?: L.TileLayer;

  ngOnInit() {
    this.initializeMap();
    this.loadSatelliteTiles();
  }

  private initializeMap() {
    this.map = L.map('map').setView([-34.6037, -58.3816], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private loadSatelliteTiles() {
    this.satelliteTilesService.getAvailableProducts().subscribe(products => {
      console.log('Productos disponibles:', products);
      
      // Buscar el producto ASH RGB
      const ashRgbProduct = products.find(p => p.name.includes('ash_rgb'));
      
      if (ashRgbProduct) {
        const layer = this.satelliteTilesService.createAshRgbLayer(ashRgbProduct);
        this.addTileLayerToMap(layer);
      }
    });
  }

  private addTileLayerToMap(tileLayerData: TileLayerData) {
    this.ashRgbLayer = L.tileLayer(tileLayerData.urlTemplate, {
      minZoom: tileLayerData.minZoom,
      maxZoom: tileLayerData.maxZoom,
      opacity: tileLayerData.opacity ?? 0.8,
      attribution: tileLayerData.attribution,
    });

    // Agregar al mapa por defecto
    this.ashRgbLayer.addTo(this.map);
  }

  toggleAshRgbLayer() {
    if (!this.ashRgbLayer) return;
    
    if (this.map.hasLayer(this.ashRgbLayer)) {
      this.map.removeLayer(this.ashRgbLayer);
    } else {
      this.ashRgbLayer.addTo(this.map);
    }
  }
}
*/

// Ejemplo 2: Listar todos los productos disponibles
// ================================================

/*
@Component({
  selector: 'app-tile-products-list',
  template: `
    <h2>Productos Satelitales Disponibles</h2>
    <ul>
      <li *ngFor="let product of products">
        {{ product.name }} 
        (Zoom: {{ product.zoom_levels[0] }}-{{ product.zoom_levels[product.zoom_levels.length-1] }})
        <button (click)="loadProduct(product)">Cargar</button>
      </li>
    </ul>
  `,
})
export class TileProductsListComponent implements OnInit {
  private satelliteTilesService = inject(SatelliteTilesService);
  
  products: TileProduct[] = [];

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.satelliteTilesService.getAvailableProducts().subscribe(products => {
      this.products = products;
      console.log('Productos cargados:', products);
    });
  }

  loadProduct(product: TileProduct) {
    const layer = this.satelliteTilesService.createTileLayer(product);
    console.log('Capa creada:', layer);
    // Aquí puedes emitir un evento o llamar a un servicio para agregar la capa al mapa
  }
}
*/

// Ejemplo 3: Integración con un servicio de capas
// ==============================================

/*
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LayerManagerService {
  private satelliteTilesService = inject(SatelliteTilesService);
  
  private activeLayers$ = new BehaviorSubject<TileLayerData[]>([]);
  
  getActiveLayers() {
    return this.activeLayers$.asObservable();
  }

  loadAllSatelliteTiles() {
    this.satelliteTilesService.getAllTileLayers().subscribe(layers => {
      this.activeLayers$.next(layers);
    });
  }

  addTileLayer(product: TileProduct) {
    const layer = this.satelliteTilesService.createTileLayer(product);
    const current = this.activeLayers$.value;
    this.activeLayers$.next([...current, layer]);
  }

  removeTileLayer(layerId: string) {
    const current = this.activeLayers$.value;
    this.activeLayers$.next(current.filter(l => l.id !== layerId));
  }
}
*/

// Ejemplo 4: URL directa sin servicio (para testing rápido)
// ========================================================

/*
// En tu componente de mapa, puedes agregar directamente:

const ashRgbUrl = 'http://localhost:5000/tiles/ash_rgb_202601080150/{z}/{x}/{y}.webp';

const tileLayer = L.tileLayer(ashRgbUrl, {
  minZoom: 4,
  maxZoom: 8,
  opacity: 0.75,
  attribution: 'ASH RGB Satellite',
});

tileLayer.addTo(map);
*/

// Ejemplo 5: Verificar que el tile server está corriendo
// =====================================================

/*
@Component({
  selector: 'app-health-check',
  template: `
    <div>
      Tile Server Status: 
      <span [class.online]="isOnline" [class.offline]="!isOnline">
        {{ isOnline ? 'Online' : 'Offline' }}
      </span>
    </div>
  `,
  styles: [`
    .online { color: green; font-weight: bold; }
    .offline { color: red; font-weight: bold; }
  `]
})
export class HealthCheckComponent implements OnInit {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  
  isOnline = false;

  ngOnInit() {
    this.checkTileServerHealth();
  }

  checkTileServerHealth() {
    const healthUrl = `${this.apiConfig.getTileServerUrl()}/health`;
    
    this.http.get(healthUrl).subscribe({
      next: () => this.isOnline = true,
      error: () => this.isOnline = false
    });
  }
}
*/

export const SATELLITE_TILES_EXAMPLES = 'See comments in this file for usage examples';
