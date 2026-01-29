import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { Layer, LayerType, LayerCategory, WmsLayer, TileLayer } from '../../models';
import { BACKEND_CONFIG } from '../../config/backend.config';
import { NotificationService } from '../notifications/notification.service';
import { LayerConfigService } from '../layers/layer-config.service';
import {
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from '../../config/layers/ign/ign-wms.config';

/**
 * Servicio para crear tile layers de Leaflet según tipo de capa
 * Factory pattern: convierte Layer models en L.TileLayers configurados
 * El renderizado se basa en LayerType (TILE, WMS) y no en la categoría
 */
@Injectable({
  providedIn: 'root',
})
export class LayerRendererService {
  private readonly notificationService = inject(NotificationService);
  private readonly layerConfigService = inject(LayerConfigService);

  // Track de errores por capa para evitar spam de notificaciones
  private readonly errorTracker = new Map<string, number>();
  private readonly MAX_ERRORS_BEFORE_NOTIFY = 5;

  // Tile Layer Pool: cache de instancias de L.TileLayer para reutilización
  private layerPool = new Map<string, L.TileLayer>();

  /**
   * Obtiene una instancia de TileLayer para un tiempo específico (usando pool)
   */
  getTileLayerForTime(layer: Layer, timeIndex: number): L.TileLayer {
    // 1. Obtener ID del tileset para generar clave única
    const tilesets = this.layerConfigService.getTilesets(layer.id);
    let tilesetId = 'default';

    if (tilesets && tilesets[timeIndex]) {
      tilesetId = tilesets[timeIndex].id;
    } else if (layer.category === LayerCategory.SATELLITE_ABI) {
      // Si es satélite y no hay config aún, es un placeholder temporal
      tilesetId = `placeholder-${timeIndex}`;
    }

    const poolKey = `${layer.id}-${tilesetId}`;

    // 2. Verificar pool
    if (this.layerPool.has(poolKey)) {
      return this.layerPool.get(poolKey)!;
    }

    // 3. Crear nueva instancia según el TIPO de capa (no la categoría)
    let tileLayer: L.TileLayer;

    switch (layer.type) {
      case LayerType.TILE:
        tileLayer = this.createTileLayer(layer, timeIndex);
        break;
      case LayerType.WMS:
        tileLayer = this.createWmsLayer(layer);
        break;
      default:
        // Exhaustiveness check - TypeScript will error if we add a new LayerType and forget to handle it
        throw new Error(`Unsupported layer type`);
    }

    // 4. Configurar errores (solo una vez)
    const isPlaceholder = (tileLayer as any)._isPlaceholder;
    if (!BACKEND_CONFIG.useMockTiles && !isPlaceholder) {
      this.attachErrorHandlers(tileLayer, layer);
    }

    // 5. Guardar en pool y retornar
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Limpia capas antiguas del pool que no están en uso
   * @param activeKeys Set de claves (layerId-tilesetId) que DEBEN mantenerse
   */
  prunePool(activeKeys: Set<string>): void {
    for (const [key] of this.layerPool) {
      if (!activeKeys.has(key)) {
        // Opcional: limpiar listeners si fuera necesario, pero Leaflet lo maneja bien
        this.layerPool.delete(key);
      }
    }
    // console.log(`Pool size: ${this.layerPool.size} (Active: ${activeKeys.size})`);
  }

  /**
   * Crea un tile layer estándar (satélites, rasters, etc.)
   * La categoría determina el comportamiento específico de cada tipo de dato
   */
  private createTileLayer(layer: TileLayer, timeIndex: number = 0): L.TileLayer {
    // TypeScript already knows layer is TileLayer
    // Según la categoría, obtener configuración específica
    switch (layer.category) {
      case LayerCategory.SATELLITE_ABI:
        return this.createSatelliteTileLayer(layer, timeIndex);
      default:
        throw new Error(`Unsupported tile layer category: ${layer.category}`);
    }
  }

  /**
   * Crea un tile layer WMS
   * La categoría determina el comportamiento específico
   */
  private createWmsLayer(layer: WmsLayer): L.TileLayer {
    switch (layer.category) {
      case LayerCategory.IGN_WMS:
        return this.createIgnWmsLayer(layer);
      default:
        throw new Error(`Unsupported WMS layer category: ${layer.category}`);
    }
  }

  /**
   * Crea un tile layer para satélite ABI
   * Lee configuración directamente del objeto TileLayer
   */
  private createSatelliteTileLayer(layer: TileLayer, timeIndex: number = 0): L.TileLayer {
    // Si hay configuración dinámica cargada, usarla
    if (this.layerConfigService.hasConfig(layer.id)) {
      const config = this.layerConfigService.getChannelConfig(layer.id);
      const tileUrl = this.layerConfigService.buildTileUrl(layer.id, timeIndex);

      if (config && tileUrl) {
        const bounds = config.channel_info.bounding_box;
        const zoomLevels = config.channel_info.zoom_levels;

        // Buffer de seguridad para evitar clipping de tiles en los bordes al hacer zoom
        const buffer = 5.0;

        return L.tileLayer(tileUrl, {
          minNativeZoom: zoomLevels.min,
          maxNativeZoom: zoomLevels.max,
          minZoom: 0,
          maxZoom: 18,
          bounds: [
            [bounds.miny - buffer, bounds.minx - buffer],
            [bounds.maxy + buffer, bounds.maxx + buffer],
          ],
          noWrap: true,
          attribution: `${config.product} ${config.instrument} ${config.channel} | SMN`,
          opacity: layer.opacity / 100,
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

  /**
   * Crea un tile layer WMS para capas del IGN
   * Usa wmsWorkspace si está definido, sino usa la URL por defecto
   */
  private createIgnWmsLayer(layer: WmsLayer): L.TileLayer {
    const url = layer.wmsWorkspace
      ? IGN_WMS_WORKSPACE_URLS[layer.wmsWorkspace] || IGN_WMS_BASE_CONFIG.defaultUrl
      : IGN_WMS_BASE_CONFIG.defaultUrl;

    return L.tileLayer.wms(url, {
      layers: layer.wmsLayerName,
      format: IGN_WMS_BASE_CONFIG.format,
      transparent: IGN_WMS_BASE_CONFIG.transparent,
      version: IGN_WMS_BASE_CONFIG.version,
      crs: L.CRS.EPSG3857,
      opacity: layer.opacity / 100,
      attribution: IGN_WMS_BASE_CONFIG.attribution,
    });
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
        `(${errorCount}/${this.MAX_ERRORS_BEFORE_NOTIFY})`,
      );

      // Después de varios errores consecutivos, notificar al usuario
      if (errorCount >= this.MAX_ERRORS_BEFORE_NOTIFY) {
        const currentErrors = this.errorTracker.get(layer.id) || 0;

        // Solo notificar la primera vez para no spamear
        if (currentErrors === 0) {
          this.notificationService.error(
            `La capa "${layer.name}" no está disponible temporalmente. Verificá la conexión con el servidor.`,
            layer.id,
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
}
