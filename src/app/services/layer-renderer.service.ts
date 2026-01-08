import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { Layer, LayerCategory } from '../models';
import { BACKEND_CONFIG } from '../config/backend.config';
import { NotificationService } from './notification.service';
import { createAbiTileLayer } from '../config/layer-tiles/satellite-abi.tiles';

/**
 * Servicio para crear tile layers según el tipo de capa
 * Reporta errores de carga a través del NotificationService
 */
@Injectable({
  providedIn: 'root',
})
export class LayerRendererService {
  private readonly notificationService = inject(NotificationService);

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
        tileLayer = createAbiTileLayer(layer.id, layer.opacity);
        break;
      default:
        throw new Error(`Unsupported layer category: ${layer.category}`);
    }

    // Solo monitorear errores si NO estamos usando mock
    if (!BACKEND_CONFIG.useMockTiles) {
      this.attachErrorHandlers(tileLayer, layer);
    }

    return tileLayer;
  }

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
