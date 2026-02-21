import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { ChannelConfig, ChannelConfigCache, RadarConfig, Tileset } from '../../models';
import { BACKEND_CONFIG } from '../../config/backend.config';
import { NotificationService } from '../notifications/notification.service';

/**
 * Servicio para gestionar configuraciones de canales satelitales
 */
@Injectable({
  providedIn: 'root',
})
export class LayerConfigService {
  private _configCache = signal<ChannelConfigCache>({});
  public readonly configCache = this._configCache.asReadonly();

  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  /**
   * Obtiene la configuración de un canal desde el backend
   * @param layerId ID de la capa (ej: 'abi-ch13')
   * @param product Producto (ej: 'goes-19')
   * @param instrument Instrumento (ej: 'abi')
   * @param channel Canal (ej: 'ch-13')
   */
  loadChannelConfig(
    layerId: string,
    product: string,
    instrument: string,
    channel: string
  ): Observable<ChannelConfig> {
    const url = BACKEND_CONFIG.endpoints.channelConfig(product, instrument, channel);

    return this.http.get<ChannelConfig>(url).pipe(
      tap((config: ChannelConfig) => {
        // Ordenar tilesets por ID (que incluye timestamp) antes de guardar
        if (config.tilesets && config.tilesets.length > 0) {
          config.tilesets.sort((a: Tileset, b: Tileset) => {
            // Extraer timestamp del ID
            // ABI formato: OR_ABI-L1b-RadF-M6C13_G19_s20261234567 (11 dígitos)
            // GLM formato: GLM_FED_s2026044013000 (13 dígitos)
            const matchA = a.id.match(/_s(\d+)/);
            const matchB = b.id.match(/_s(\d+)/);
            if (matchA && matchB) {
              return matchA[1].localeCompare(matchB[1]);
            }
            return a.id.localeCompare(b.id);
          });
        }

        // Guardar en cache
        const cache = this._configCache();
        this._configCache.set({ ...cache, [layerId]: config });
      }),
      catchError((error: any) => {
        console.error(`❌ Error cargando configuración de ${layerId}:`, error);
        this.notificationService.error(
          'Error al cargar canal: no se pudo obtener la configuración del servidor'
        );
        throw error;
      })
    );
  }

  /**
   * Obtiene la configuración de un radar desde el backend
   * @param layerId ID de la capa (ej: 'rma1-dbzh')
   * @param radarId ID del radar (ej: 'RMA1')
   * @param variableId ID de la variable (ej: 'DBZH')
   * @param elevationId ID de la elevación (ej: 'elev0')
   */
  loadRadarConfig(
    layerId: string,
    radarId: string,
    variableId: string,
    elevationId: string
  ): Observable<any> {
    const url = `${BACKEND_CONFIG.baseUrl}/products/radar/${radarId}/${variableId}/${elevationId}`;

    return this.http.get<any>(url).pipe(
      tap((response: any) => {
        // Construir config similar a ChannelConfig
        const config = {
          radar_id: response.radar,
          variable_id: response.variable,
          elevation_id: response.elevation,
          tilesets: response.tilesets || [],
          tile_url_pattern: `/products/radar/${radarId}/${variableId}/${elevationId}/{tileset_id}/{z}/{x}/{y}.webp`,
          channel_info: {
            name: `${radarId} ${variableId} ${elevationId}`,
            description: `Radar ${radarId} - Variable ${variableId} - Elevación ${elevationId}`,
            zoom_levels: { min: 4, max: 8 },
            bounding_box: { minx: -90, miny: -60, maxx: -30, maxy: -15 },
            tile_format: 'webp',
          },
        };

        // Ordenar tilesets por timestamp
        if (config.tilesets && config.tilesets.length > 0) {
          config.tilesets.sort((a: any, b: any) => a.id.localeCompare(b.id));
        }

        // Guardar en cache
        const cache = this._configCache();
        this._configCache.set({ ...cache, [layerId]: config });
      }),
      catchError((error: any) => {
        console.error(`❌ Error cargando configuración de radar ${layerId}:`, error);
        this.notificationService.error(
          'Error al cargar radar: no se pudo obtener la configuración del servidor'
        );
        throw error;
      })
    );
  }

  /**
   * Recarga la configuración de un canal (actualiza tilesets disponibles)
   */
  reloadChannelConfig(
    layerId: string,
    product: string,
    instrument: string,
    channel: string
  ): Observable<ChannelConfig> {
    return this.loadChannelConfig(layerId, product, instrument, channel);
  }

  /**
   * Obtiene configuración cacheada de un canal
   */
  getChannelConfig(layerId: string): ChannelConfig | RadarConfig | undefined {
    return this._configCache()[layerId];
  }

  /**
   * Obtiene todos los tilesets disponibles para un canal
   */
  getTilesets(layerId: string) {
    return this.getChannelConfig(layerId)?.tilesets || [];
  }

  /**
   * Construye la URL de un tile dado el patrón y el tileset_id
   */
  buildTileUrl(layerId: string, tilesetIndex: number): string | null {
    const config = this.getChannelConfig(layerId);
    if (!config || !config.tilesets[tilesetIndex]) {
      return null;
    }

    const tileset = config.tilesets[tilesetIndex];
    const pattern = config.tile_url_pattern;

    // Reemplazar {tileset_id} en el patrón
    let url = `${BACKEND_CONFIG.baseUrl}${pattern.replace('{tileset_id}', tileset.id)}`;

    // Cache-busting removed: Backend now sends Immutable and ETag headers
    // url += `?t=${tileset.id}`;

    return url;
  }

  /**
   * Verifica si un canal tiene configuración cargada
   */
  hasConfig(layerId: string): boolean {
    return !!this._configCache()[layerId];
  }
}
