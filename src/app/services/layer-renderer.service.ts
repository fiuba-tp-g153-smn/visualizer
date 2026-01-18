import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { Layer, LayerCategory } from '../models';
import { BACKEND_CONFIG } from '../config/backend.config';
import { NotificationService } from './notification.service';
import { ChannelConfigService } from './channel-config.service';
import { getAbiTileConfig } from '../config/layer-tiles/satellite/abi.tiles';

/**
 * Servicio para crear tile layers de Leaflet según categoría
 * Factory pattern: convierte Layer models en L.TileLayers configurados
 */
@Injectable({
  providedIn: 'root',
})
export class LayerRendererService {
  private readonly notificationService = inject(NotificationService);
  private readonly channelConfigService = inject(ChannelConfigService);

  // Track de errores por capa para evitar spam de notificaciones
  private readonly errorTracker = new Map<string, number>();
  private readonly MAX_ERRORS_BEFORE_NOTIFY = 5;

  /**
   * Crea un tile layer de Leaflet según la categoría de la capa
   */
  createTileLayer(layer: Layer): L.TileLayer {
    let tileLayer: L.TileLayer;

    switch (layer.category) {
      case LayerCategory.SATELLITE_ABI:
        tileLayer = this.createAbiTileLayer(layer.id, layer.opacity, layer.timeIndex ?? 0);
        break;
      default:
        throw new Error(`Unsupported layer category: ${layer.category}`);
    }

    // Solo monitorear errores si NO estamos usando mock Y NO es un placeholder
    const isPlaceholder = (tileLayer as any)._isPlaceholder;
    if (!BACKEND_CONFIG.useMockTiles && !isPlaceholder) {
      this.attachErrorHandlers(tileLayer, layer);
    }

    return tileLayer;
  }

  /**
   * Crea un tile layer para satélite ABI
   */
  private createAbiTileLayer(layerId: string, opacity: number, timeIndex: number = 0): L.TileLayer {
    // Si hay configuración dinámica cargada, usarla
    if (this.channelConfigService.hasConfig(layerId)) {
      const config = this.channelConfigService.getChannelConfig(layerId);
      const tileUrl = this.channelConfigService.buildTileUrl(layerId, timeIndex);

      if (config && tileUrl) {
        const bounds = config.channel_info.bounding_box;
        const zoomLevels = config.channel_info.zoom_levels;

        return L.tileLayer(tileUrl, {
          minNativeZoom: zoomLevels.min,
          maxNativeZoom: zoomLevels.max,
          minZoom: 0,
          maxZoom: 18,
          tms: true,
          bounds: [
            [bounds.miny, bounds.minx],
            [bounds.maxy, bounds.maxx],
          ],
          noWrap: true,
          attribution: `${config.product} ${config.instrument} ${config.channel} | SMN`,
          opacity: opacity / 100,
        });
      }
    }

    // Si no hay configuración, crear un layer vacío/placeholder
    // Esto evita errores de carga mientras se obtiene la configuración del backend
    const placeholder = L.tileLayer('about:blank', {
      opacity: 0,
      attribution: 'Cargando...',
    });
    (placeholder as any)._isPlaceholder = true;
    return placeholder;
  }

  // Para agregar WRF, ECMWF, etc., solo agregar un nuevo case y método privado:
  // case LayerCategory.WRF:
  //   tileLayer = this.createWrfTileLayer(layer.id, layer.opacity);
  //   break;
  //
  // private createWrfTileLayer(layerId: string, opacity: number): L.TileLayer {
  //   const { url, options } = getWrfTileConfig(layerId);
  //   return L.tileLayer(url, { ...options, opacity: opacity / 100 });
  // }

  /**
   * Adjunta manejadores de error a un tile layer
   */
  private attachErrorHandlers(tileLayer: L.TileLayer, layer: Layer): void {
    let errorCount = 0;

    tileLayer.on('tileerror', (error: L.TileErrorEvent) => {
      errorCount++;
      console.warn(
        `Error cargando tile de ${layer.name}:`,
        error.error,
        `(${errorCount}/${this.MAX_ERRORS_BEFORE_NOTIFY})`
      );

      // Después de varios errores consecutivos, notificar al usuario
      if (errorCount >= this.MAX_ERRORS_BEFORE_NOTIFY) {
        const currentErrors = this.errorTracker.get(layer.id) || 0;

        // Solo notificar la primera vez para no spamear
        if (currentErrors === 0) {
          this.notificationService.error(
            `La capa "${layer.name}" no está disponible temporalmente. Verificá la conexión con el servidor.`,
            layer.id
          );
        }

        this.errorTracker.set(layer.id, currentErrors + 1);
        errorCount = 0; // Reset para próximo batch
      }
    });

    // Si empieza a cargar bien, resetear contador y limpiar errores
    tileLayer.on('tileload', () => {
      if (errorCount > 0) {
        errorCount = Math.max(0, errorCount - 1);
      }

      // Si había errores previos, limpiar
      if (this.errorTracker.has(layer.id)) {
        console.info(`✅ Capa ${layer.name} se recuperó`);
        this.errorTracker.delete(layer.id);
      }
    });
  }

  // Para agregar WRF, ECMWF, etc., solo agregar un nuevo case:
  // case LayerCategory.WRF:
  //   tileLayer = createWrfTileLayer(layer.id, layer.opacity);
  //   break;
}
