import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { TileLayerData, TileProduct, TileProductsResponse } from '../models/map-data.models';

/**
 * Servicio para gestionar tiles satelitales XYZ
 * Consume el tile server Python que sirve productos pre-procesados con gdal2tiles
 */
@Injectable({
  providedIn: 'root',
})
export class SatelliteTilesService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);

  /**
   * Obtiene la lista de productos de tiles disponibles
   */
  getAvailableProducts(): Observable<TileProduct[]> {
    const url = this.apiConfig.getTileProductsUrl();

    return this.http.get<TileProductsResponse>(url).pipe(
      map((response) => response.products),
      catchError((error) => {
        console.error('Error al obtener productos de tiles:', error);
        return of([]);
      })
    );
  }

  /**
   * Crea la configuración de capa para un tile layer
   * @param product Producto del tile server
   * @param options Opciones adicionales
   */
  createTileLayer(
    product: TileProduct,
    options?: {
      opacity?: number;
      attribution?: string;
      metadata?: TileLayerData['metadata'];
    }
  ): TileLayerData {
    const urlTemplate = this.apiConfig.buildTileUrl(product.name, product.tile_format);

    const minZoom = Math.min(...product.zoom_levels);
    const maxZoom = Math.max(...product.zoom_levels);

    return {
      id: `tile-${product.name}`,
      name: this.formatProductName(product.name),
      productName: product.name,
      urlTemplate,
      minZoom,
      maxZoom,
      opacity: options?.opacity ?? 0.8,
      attribution: options?.attribution ?? 'Tile Server | Procesado con gdal2tiles',
      metadata: options?.metadata,
    };
  }

  /**
   * Crea una capa de tile específica para ASH RGB
   */
  createAshRgbLayer(product: TileProduct): TileLayerData {
    return this.createTileLayer(product, {
      opacity: 0.75,
      attribution: 'ASH RGB | Producto Satelital',
      metadata: {
        tipo: 'ash_rgb',
        producto: 'Ash RGB Composite',
        fecha: this.extractDateFromProductName(product.name),
        satelite: 'GOES-16', // Puede ajustarse según el producto
      },
    });
  }

  /**
   * Obtiene todas las capas de tiles disponibles
   */
  getAllTileLayers(): Observable<TileLayerData[]> {
    return this.getAvailableProducts().pipe(
      map((products) =>
        products.map((product) => {
          // Detectar tipo de producto por el nombre
          if (product.name.includes('ash_rgb')) {
            return this.createAshRgbLayer(product);
          }
          // Agregar más tipos según sea necesario
          return this.createTileLayer(product);
        })
      )
    );
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  /**
   * Formatea el nombre del producto para mostrarlo al usuario
   */
  private formatProductName(productName: string): string {
    // Convertir ash_rgb_202601080150 -> "ASH RGB (2026-01-08 01:50)"
    const parts = productName.split('_');

    if (parts.length >= 3 && parts[0] === 'ash' && parts[1] === 'rgb') {
      const dateStr = parts[2];
      if (dateStr.length === 12) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(8, 10);
        const minute = dateStr.substring(10, 12);
        return `ASH RGB (${year}-${month}-${day} ${hour}:${minute})`;
      }
    }

    // Formato por defecto: reemplazar guiones bajos y capitalizar
    return productName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Extrae la fecha de un nombre de producto
   */
  private extractDateFromProductName(productName: string): string | undefined {
    const match = productName.match(/(\d{12})/);
    if (match) {
      const dateStr = match[1];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(8, 10);
      const minute = dateStr.substring(10, 12);
      return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
    }
    return undefined;
  }
}
