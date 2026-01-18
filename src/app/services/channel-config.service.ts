import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { ChannelConfig, ChannelConfigCache } from '../models';
import { BACKEND_CONFIG } from '../config/backend.config';
import { NotificationService } from './notification.service';

/**
 * Servicio para gestionar configuraciones de canales satelitales
 */
@Injectable({
  providedIn: 'root',
})
export class ChannelConfigService {
  private _configCache = signal<ChannelConfigCache>({});
  public readonly configCache = this._configCache.asReadonly();

  constructor(private http: HttpClient, private notificationService: NotificationService) {}

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

    console.log(`🛰️ Cargando configuración de canal: ${url}`);

    return this.http.get<ChannelConfig>(url).pipe(
      tap((config) => {
        // Ordenar tilesets por ID (que incluye timestamp) antes de guardar
        if (config.tilesets && config.tilesets.length > 0) {
          config.tilesets.sort((a, b) => {
            // Extraer timestamp del ID (formato: OR_ABI-L1b-RadF-M6C13_G19_s20261234567)
            const matchA = a.id.match(/_s(\d{11})/);
            const matchB = b.id.match(/_s(\d{11})/);
            if (matchA && matchB) {
              return matchA[1].localeCompare(matchB[1]);
            }
            return a.id.localeCompare(b.id);
          });
        }

        // Guardar en cache
        const cache = this._configCache();
        this._configCache.set({ ...cache, [layerId]: config });

        this.notificationService.success(
          `Canal ${config.channel} cargado: ${config.tilesets.length} períodos disponibles`
        );
        console.log(`✅ Configuración cargada para ${layerId}:`, config);
      }),
      catchError((error) => {
        console.error(`❌ Error cargando configuración de ${layerId}:`, error);
        this.notificationService.error(
          'Error al cargar canal: no se pudo obtener la configuración del servidor'
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
    console.log(`🔄 Recargando configuración de ${layerId}...`);
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
    
    // Agregar tileset_id como parámetro para evitar caché cuando cambia el período
    url += `?t=${tileset.id}`;

    console.log(`🗺️ URL construida para ${layerId} [${tilesetIndex}]: ${url}`);
    return url;
  }

  /**
   * Verifica si un canal tiene configuración cargada
   */
  hasConfig(layerId: string): boolean {
    return !!this._configCache()[layerId];
  }
}
