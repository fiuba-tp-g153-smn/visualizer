import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Servicio de configuración centralizada para el backend
 * Todas las URLs y endpoints se definen aquí
 */
@Injectable({
  providedIn: 'root',
})
export class ApiConfigService {
  // URL base del backend - se puede cambiar según el ambiente
  private readonly baseUrl = environment.apiUrl ?? 'http://localhost:8080';
  private readonly tileServerUrl = environment.tileServerUrl ?? 'http://localhost:5000';

  // ==========================================================================
  // ENDPOINTS
  // ==========================================================================

  readonly endpoints = {
    // Puntos de estaciones
    emas: 'emas',
    synop: 'synop',
    metar: 'metar',

    // Imágenes satelitales
    satellite: {
      abi: 'satellite/abi',
      glm: 'satellite/glm',
    },

    // Radar
    radar: 'radar',

    // Modelos numéricos
    models: {
      wrf: 'models/wrf',
      gfs: 'models/gfs',
      ecmwf: 'models/ecmwf',
    },

    // Vectores
    vectors: {
      wind: 'vectors/wind',
    },

    // Tiles XYZ (productos satelitales pre-procesados)
    tiles: {
      products: 'products', // Lista de productos disponibles
      satellite: 'tiles', // Base para tiles satelitales
    },
  } as const;

  // ==========================================================================
  // MÉTODOS PARA CONSTRUIR URLs
  // ==========================================================================

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getTileServerUrl(): string {
    return this.tileServerUrl;
  }

  /**
   * Construye la URL completa para un endpoint
   */
  buildUrl(endpoint: string, params?: Record<string, string | number>): string {
    let url = `${this.baseUrl}/${endpoint}`;

    if (params) {
      const queryString = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  /**
   * Construye URL para imágenes raster con bounds
   */
  buildRasterUrl(
    endpoint: string,
    options?: {
      producto?: string;
      fecha?: string;
      canal?: string;
    }
  ): string {
    return this.buildUrl(endpoint, options as Record<string, string>);
  }

  /**
   * Construye URL template para tiles XYZ
   * Formato: http://localhost:5000/tiles/{productName}/{z}/{x}/{y}.webp
   */
  buildTileUrl(productName: string, extension: string = 'webp'): string {
    return `${this.tileServerUrl}/tiles/${productName}/{z}/{x}/{y}.${extension}`;
  }

  /**
   * Construye URL para listar productos de tiles disponibles
   */
  getTileProductsUrl(): string {
    return `${this.tileServerUrl}/products`;
  }
}
