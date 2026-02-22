import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { ChannelConfig, ChannelConfigCache } from '../../models';
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
    channel: string,
  ): Observable<ChannelConfig> {
    const url = BACKEND_CONFIG.endpoints.channelConfig(product, instrument, channel);

    return this.http.get<ChannelConfig>(url).pipe(
      tap((config) => {
        // Ordenar tilesets por ID (que es directamente el timestamp) antes de guardar
        if (config.tilesets && config.tilesets.length > 0) {
          config.tilesets.sort((a, b) => {
            // Los IDs son ahora directamente timestamps numéricos (ej: 20260521320209)
            return a.id.localeCompare(b.id);
          });
        }

        // Guardar en cache
        const cache = this._configCache();
        this._configCache.set({ ...cache, [layerId]: config });
      }),
      catchError((error) => {
        console.error(`❌ Error cargando configuración de ${layerId}:`, error);
        this.notificationService.error(
          'Error al cargar canal: no se pudo obtener la configuración del servidor',
        );
        throw error;
      }),
    );
  }

  /**
   * Recarga la configuración de un canal (actualiza tilesets disponibles)
   */
  reloadChannelConfig(
    layerId: string,
    product: string,
    instrument: string,
    channel: string,
  ): Observable<ChannelConfig> {
    return this.loadChannelConfig(layerId, product, instrument, channel);
  }

  /**
   * Obtiene configuración cacheada de un canal
   */
  getChannelConfig(layerId: string): ChannelConfig | undefined {
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
