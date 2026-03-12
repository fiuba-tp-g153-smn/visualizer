import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { LayerType, LayerCategory } from '../../models';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { TilePrefetchService } from './tile-prefetch.service';

/**
 * Representa un período temporal con su timestamp y el índice en la capa
 */
export interface TimePeriod {
  timestamp: Date;
  layerId: string;
  index: number;
}

/**
 * Configuración para el reproductor sincronizado
 */
export interface SyncPlaybackConfig {
  selectedLayerIds: string[];
  minTime?: Date;
  maxTime?: Date;
  speed: number; // Minutos reales por segundo de reproducción
  isPlaying: boolean;
  currentTime?: Date;
}

/**
 * Servicio responsable de sincronizar la reproducción temporal de múltiples capas.
 *
 * Este servicio permite:
 * - Seleccionar múltiples capas activas con períodos temporales
 * - Calcular la intersección de períodos disponibles
 * - Reproducir sincronizadamente múltiples fuentes de datos
 * - Controlar la velocidad de reproducción en minutos reales por segundo
 */
@Injectable({
  providedIn: 'root',
})
export class SyncPlaybackService {
  private readonly layerControlService = inject(LayerControlService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly tilePrefetchService = inject(TilePrefetchService);

  private playbackInterval?: number;

  // Almacena el lastImagesCount original de cada capa antes de modificarlo para sync playback
  private originalLastImagesCount = new Map<string, number>();

  constructor() {
    // Automatically remove layers that are no longer eligible
    effect(
      () => {
        const eligibleIds = new Set(this.eligibleLayers().map((item) => item.layer.id));
        const selectedIds = this.config().selectedLayerIds;

        // Find layers that are selected but no longer eligible
        const invalidIds = selectedIds.filter((id) => !eligibleIds.has(id));

        if (invalidIds.length > 0) {
          // Restore original lastImagesCount for invalid layers
          invalidIds.forEach((layerId) => {
            this.restoreOriginalLastImagesCount(layerId);
          });

          // Remove invalid layers from selection
          this.config.set({
            ...this.config(),
            selectedLayerIds: selectedIds.filter((id) => eligibleIds.has(id)),
          });

          // Update time range after removing layers
          this.updateTimeRange();
        }
      },
      { allowSignalWrites: true },
    );
  }

  private readonly config = signal<SyncPlaybackConfig>({
    selectedLayerIds: [],
    speed: 1, // 1 minuto real por segundo de reproducción por defecto
    isPlaying: false,
  });

  readonly syncConfig = this.config.asReadonly();

  /**
   * Obtiene las capas activas que tienen más de un período disponible
   */
  readonly eligibleLayers = computed(() => {
    return this.layerControlService
      .activeLayers()
      .filter(({ layer }) => {
        if (layer.type !== LayerType.TILE) return false;

        const tilesets = this.layerConfigService.getAvailableTilesets(layer.id);
        return tilesets && tilesets.length > 1;
      })
      .map(({ layer, controls }) => ({ layer, controls }))
      .sort((a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0));
  });

  /**
   * Obtiene todos los períodos disponibles para una capa, parseados como Date
   */
  private getLayerPeriods(layerId: string): TimePeriod[] {
    const tilesets = this.layerConfigService.getAvailableTilesets(layerId);
    if (!tilesets) return [];

    const layer = this.eligibleLayers().find((item) => item.layer.id === layerId)?.layer;
    if (!layer) return [];

    return tilesets
      .map((tileset, index) => {
        const timestamp = this.parseTilesetTimestamp(tileset, layer.category);
        if (!timestamp) return null;
        return { timestamp, layerId, index };
      })
      .filter((period): period is TimePeriod => period !== null);
  }

  /**
   * Parsea un tileset según la categoría de la capa
   */
  private parseTilesetTimestamp(tileset: string, category: LayerCategory): Date | null {
    switch (category) {
      case LayerCategory.GOES_19:
        return this.parseGoesTimestamp(tileset);
      case LayerCategory.RADAR:
        return this.parseRadarTimestamp(tileset);
      default:
        return null;
    }
  }

  /**
   * Parsea timestamp GOES en formato juliano YYYYJJJHHMMSSS
   */
  private parseGoesTimestamp(tileset: string): Date | null {
    if (tileset.length < 11) return null;

    const year = parseInt(tileset.substring(0, 4));
    const dayOfYear = parseInt(tileset.substring(4, 7));
    const hour = parseInt(tileset.substring(7, 9));
    const minute = parseInt(tileset.substring(9, 11));

    const date = new Date(year, 0);
    date.setDate(dayOfYear);
    date.setHours(hour, minute, 0, 0);

    return date;
  }

  /**
   * Parsea timestamp RADAR en formato ISO-like YYYYMMDDTHHMMSSZ
   */
  private parseRadarTimestamp(tileset: string): Date | null {
    if (tileset.length < 15) return null;

    const year = parseInt(tileset.substring(0, 4));
    const month = parseInt(tileset.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(tileset.substring(6, 8));
    const hour = parseInt(tileset.substring(9, 11));
    const minute = parseInt(tileset.substring(11, 13));
    const second = parseInt(tileset.substring(13, 15));

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Calcula el rango de tiempo disponible para las capas seleccionadas
   * Retorna undefined si no hay intersección
   */
  readonly availableTimeRange = computed(() => {
    const selectedIds = this.config().selectedLayerIds;
    if (selectedIds.length === 0) return undefined;

    const allPeriods = selectedIds.map((id) => this.getLayerPeriods(id));

    // Verificar que todas las capas tengan períodos
    if (allPeriods.some((periods) => periods.length === 0)) {
      return undefined;
    }

    console.log('[SyncPlayback] Calculating available time range for selected layers', {
      selectedIds,
      allPeriods: allPeriods.map((periods) =>
        periods.map((p) => ({ timestamp: p.timestamp.toISOString(), layerId: p.layerId })),
      ),
    });

    // Encontrar el primer tiempo donde todas las capas tienen datos
    const minTimes = allPeriods.map((periods) =>
      Math.min(...periods.map((p) => p.timestamp.getTime())),
    );
    const maxOfMins = Math.max(...minTimes);

    // Encontrar el último tiempo donde todas las capas tienen datos
    const maxTimes = allPeriods.map((periods) =>
      Math.max(...periods.map((p) => p.timestamp.getTime())),
    );
    const minOfMaxes = Math.min(...maxTimes);

    // Verificar que haya intersección
    if (maxOfMins > minOfMaxes) {
      return undefined; // No hay intersección
    }

    return {
      min: new Date(maxOfMins),
      max: new Date(minOfMaxes),
    };
  });

  /**
   * Verifica si hay intersección de períodos para las capas seleccionadas
   */
  readonly hasIntersection = computed(() => {
    return this.availableTimeRange() !== undefined;
  });

  // ============================================================================
  // Public Actions
  // ============================================================================

  /**
   * Selecciona o deselecciona una capa para sincronización
   */
  toggleLayerSelection(layerId: string): void {
    const current = this.config().selectedLayerIds;
    const index = current.indexOf(layerId);

    if (index === -1) {
      // Agregar capa: guardar su lastImagesCount original
      this.saveOriginalLastImagesCount(layerId);

      this.config.set({
        ...this.config(),
        selectedLayerIds: [...current, layerId],
      });
    } else {
      // Remover capa: restaurar su lastImagesCount original
      this.restoreOriginalLastImagesCount(layerId);

      this.config.set({
        ...this.config(),
        selectedLayerIds: current.filter((id) => id !== layerId),
      });
    }

    // Recalcular el rango si hay capas seleccionadas
    this.updateTimeRange();
  }

  /**
   * Actualiza el rango de tiempo basado en las capas seleccionadas
   */
  private updateTimeRange(): void {
    const range = this.availableTimeRange();
    if (range) {
      this.config.set({
        ...this.config(),
        minTime: range.min,
        maxTime: range.max,
        currentTime: range.min,
      });

      // Trigger prefetch for the new range
      this.triggerPrefetch();
    } else {
      this.config.set({
        ...this.config(),
        minTime: undefined,
        maxTime: undefined,
        currentTime: undefined,
      });
    }
  }

  /**
   * Dispara el prefetch de tiles para el rango seleccionado
   */
  private triggerPrefetch(): void {
    const cfg = this.config();
    if (!cfg.minTime || !cfg.maxTime || cfg.selectedLayerIds.length === 0) return;

    // Request prefetch for all selected layers in the time range
    this.tilePrefetchService.prefetchSyncRange(cfg.selectedLayerIds, {
      min: cfg.minTime,
      max: cfg.maxTime,
    });
  }

  /**
   * Establece el tiempo mínimo del rango
   */
  setMinTime(time: Date): void {
    const range = this.availableTimeRange();
    if (!range) return;

    // Validar que esté dentro del rango disponible
    const validTime = new Date(Math.max(time.getTime(), range.min.getTime()));

    const cfg = this.config();
    const newConfig = {
      ...cfg,
      minTime: validTime,
    };

    // Ajustar currentTime si queda fuera del nuevo rango
    if (cfg.currentTime && cfg.currentTime < validTime) {
      newConfig.currentTime = validTime;
    }

    this.config.set(newConfig);

    // Trigger prefetch for the updated range
    this.triggerPrefetch();
  }

  /**
   * Establece el tiempo máximo del rango
   */
  setMaxTime(time: Date): void {
    const range = this.availableTimeRange();
    if (!range) return;

    // Validar que esté dentro del rango disponible
    const validTime = new Date(Math.min(time.getTime(), range.max.getTime()));

    const cfg = this.config();
    const newConfig = {
      ...cfg,
      maxTime: validTime,
    };

    // Ajustar currentTime si queda fuera del nuevo rango
    if (cfg.currentTime && cfg.currentTime > validTime) {
      newConfig.currentTime = validTime;
    }

    this.config.set(newConfig);

    // Trigger prefetch for the updated range
    this.triggerPrefetch();
  }

  /**
   * Establece el tiempo actual manualmente (para el slider)
   */
  setCurrentTime(time: Date): void {
    const cfg = this.config();
    if (!cfg.minTime || !cfg.maxTime) return;

    // Validar que esté dentro del rango seleccionado
    const validTime = new Date(
      Math.max(cfg.minTime.getTime(), Math.min(time.getTime(), cfg.maxTime.getTime())),
    );

    this.config.set({
      ...cfg,
      currentTime: validTime,
    });

    // Si no está reproduciendo, actualizar capas
    if (!cfg.isPlaying) {
      this.updateLayersForCurrentTime();
    }
  }

  /**
   * Establece la velocidad de reproducción (minutos reales por segundo)
   */
  setSpeed(speed: number): void {
    const clampedSpeed = Math.max(0, Math.min(60, speed));

    this.config.set({
      ...this.config(),
      speed: clampedSpeed,
    });

    // Reiniciar reproducción si está activa
    if (this.config().isPlaying) {
      this.stopPlayback();
      setTimeout(() => this.startPlayback(), 0);
    }
  }

  /**
   * Alterna entre reproducción y pausa
   */
  togglePlayback(): void {
    if (this.config().isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  /**
   * Inicia la reproducción sincronizada
   */
  startPlayback(): void {
    const cfg = this.config();

    if (!cfg.minTime || !cfg.maxTime || cfg.selectedLayerIds.length === 0) {
      console.warn('Cannot start playback: invalid configuration');
      return;
    }

    // No permite reproducción con velocidad 0
    if (cfg.speed === 0) {
      console.warn('Cannot start playback: speed is 0');
      return;
    }

    // Trigger prefetch before starting playback
    this.triggerPrefetch();

    // Detener playback individual de todas las capas seleccionadas
    cfg.selectedLayerIds.forEach((layerId) => {
      this.layerControlService.stopPlayback(layerId);
    });

    // Setear currentTime al mínimo si no está definido
    if (!cfg.currentTime) {
      this.config.set({
        ...cfg,
        currentTime: cfg.minTime,
        isPlaying: true,
      });
    } else {
      this.config.set({
        ...cfg,
        isPlaying: true,
      });
    }

    // Iniciar intervalo de reproducción
    // speed es minutos reales por segundo
    // Actualizamos speed veces por segundo, avanzando 1 minuto cada vez
    // Ejemplo: speed=8 → actualiza cada 125ms, avanza 1 minuto
    const intervalMs = 1000 / cfg.speed; // Actualizar speed veces por segundo
    const advanceMs = 60 * 1000; // Avanzar 1 minuto real cada vez

    this.playbackInterval = window.setInterval(() => {
      this.advanceTime(advanceMs);
    }, intervalMs);

    // Actualizar inmediatamente con el tiempo actual
    this.updateLayersForCurrentTime();
  }

  /**
   * Detiene la reproducción sincronizada
   */
  stopPlayback(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = undefined;
    }

    this.config.set({
      ...this.config(),
      isPlaying: false,
    });
  }

  /**
   * Guarda el lastImagesCount original de una capa antes de modificarlo
   */
  private saveOriginalLastImagesCount(layerId: string): void {
    if (this.originalLastImagesCount.has(layerId)) return;

    const controls = this.layerControlService.getControls(layerId);
    if (controls.type === LayerType.TILE) {
      this.originalLastImagesCount.set(layerId, controls.playback.lastImagesCount);
    }
  }

  /**
   * Restaura el lastImagesCount original de una capa
   */
  private restoreOriginalLastImagesCount(layerId: string): void {
    const originalCount = this.originalLastImagesCount.get(layerId);
    if (originalCount !== undefined) {
      this.layerControlService.setLastImagesCount(layerId, originalCount);
      this.originalLastImagesCount.delete(layerId);
    }
  }

  /**
   * Avanza el tiempo actual
   */
  private advanceTime(advanceMs: number): void {
    const cfg = this.config();
    if (!cfg.currentTime || !cfg.minTime || !cfg.maxTime) return;

    const newTime = new Date(cfg.currentTime.getTime() + advanceMs);

    // Si superamos el máximo, volver al inicio
    if (newTime > cfg.maxTime) {
      this.config.set({
        ...cfg,
        currentTime: cfg.minTime,
      });
    } else {
      this.config.set({
        ...cfg,
        currentTime: newTime,
      });
    }

    this.updateLayersForCurrentTime();
  }

  /**
   * Actualiza todas las capas para mostrar el período más cercano al tiempo actual
   */
  private updateLayersForCurrentTime(): void {
    const cfg = this.config();
    if (!cfg.currentTime || !cfg.minTime || !cfg.maxTime) return;

    // Guardar referencias locales para que TypeScript infiera correctamente el tipo
    const minTime = cfg.minTime;
    const maxTime = cfg.maxTime;
    const currentTime = cfg.currentTime;

    cfg.selectedLayerIds.forEach((layerId) => {
      const periods = this.getLayerPeriods(layerId);
      if (periods.length === 0) return;

      // Encontrar el período más cercano al tiempo actual
      const closestPeriod = this.findClosestPeriod(periods, currentTime);
      if (closestPeriod) {
        // Calcular cuántos frames están dentro del rango de sync playback
        const periodsInRange = this.getPeriodsInRange(periods, minTime, maxTime);
        const frameCountInRange = periodsInRange.length;

        // Ajustar temporalmente lastImagesCount para que el prerenderizado funcione correctamente
        // Esto asegura que los frames con opacity=0 se rendericen dentro del rango de sync playback
        if (frameCountInRange > 1) {
          this.layerControlService.setLastImagesCount(layerId, frameCountInRange);
        }

        this.layerControlService.setTimeIndex(layerId, closestPeriod.index);
      }
    });
  }

  /**
   * Obtiene los períodos que están dentro del rango de tiempo especificado
   */
  private getPeriodsInRange(periods: TimePeriod[], minTime: Date, maxTime: Date): TimePeriod[] {
    const minMs = minTime.getTime();
    const maxMs = maxTime.getTime();

    return periods.filter((period) => {
      const periodMs = period.timestamp.getTime();
      return periodMs >= minMs && periodMs <= maxMs;
    });
  }

  /**
   * Encuentra el período más cercano a un tiempo dado
   */
  private findClosestPeriod(periods: TimePeriod[], targetTime: Date): TimePeriod | null {
    if (periods.length === 0) return null;

    let closest = periods[0];
    let minDiff = Math.abs(periods[0].timestamp.getTime() - targetTime.getTime());

    for (let i = 1; i < periods.length; i++) {
      const diff = Math.abs(periods[i].timestamp.getTime() - targetTime.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = periods[i];
      }
    }

    return closest;
  }

  /**
   * Limpia la selección de capas y detiene la reproducción
   */
  reset(): void {
    this.stopPlayback();

    // Restaurar lastImagesCount original de todas las capas seleccionadas
    this.config().selectedLayerIds.forEach((layerId) => {
      this.restoreOriginalLastImagesCount(layerId);
    });

    this.config.set({
      selectedLayerIds: [],
      speed: 1,
      isPlaying: false,
      minTime: undefined,
      maxTime: undefined,
      currentTime: undefined,
    });
  }
}
