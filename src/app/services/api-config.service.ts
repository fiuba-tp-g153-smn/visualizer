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
  } as const;

  // ==========================================================================
  // MÉTODOS PARA CONSTRUIR URLs
  // ==========================================================================

  getBaseUrl(): string {
    return this.baseUrl;
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
}
