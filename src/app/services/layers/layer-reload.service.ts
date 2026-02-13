import { Injectable, effect, inject } from '@angular/core';
import { LayerService } from './layer.service';
import { LayerConfigService } from './layer-config.service';
import { NotificationService } from '../notifications/notification.service';
import { LayerType, NotificationType } from '../../models';

interface RefreshState {
  intervalId?: number;
  isManualRefreshing: boolean;
  lastRefreshTime: number;
  initialCount?: number; // Track initial count to detect first vs subsequent updates
}

/**
 * Service to reload time-indexed layers (both auto and manual)
 */
@Injectable({
  providedIn: 'root',
})
export class LayerReloadService {
  private readonly layerService = inject(LayerService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly notificationService = inject(NotificationService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 10 * 1000;
  private refreshStates = new Map<string, RefreshState>();

  constructor() {
    effect(() => {
      const activeLayers = this.layerService.activeLayers();
      const activeLayerIds = new Set(activeLayers.map((l) => l.id));

      for (const layer of activeLayers) {
        if (this.hasTimeData(layer.id) && !this.refreshStates.has(layer.id)) {
          this.startAutoRefresh(layer.id);
        }
      }

      for (const layerId of this.refreshStates.keys()) {
        if (!activeLayerIds.has(layerId)) {
          this.stopAutoRefresh(layerId);
        }
      }
    });
  }

  /**
   * Manually trigger a refresh for a layer (called from UI)
   * Prevents concurrent auto/manual refreshes and resets the timer
   */
  public manualRefresh(layerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const state = this.refreshStates.get(layerId);
      if (!state) {
        this.performRefreshAndCompare(layerId, true).then(resolve).catch(reject);
        return;
      }

      if (state.isManualRefreshing) {
        resolve();
        return;
      }

      state.isManualRefreshing = true;

      if (state.intervalId !== undefined) {
        window.clearInterval(state.intervalId);
      }

      this.performRefreshAndCompare(layerId, true)
        .then(() => {
          if (state) {
            state.isManualRefreshing = false;
            state.lastRefreshTime = Date.now();
            state.intervalId = window.setInterval(() => {
              this.performAutoRefresh(layerId);
            }, this.AUTO_REFRESH_INTERVAL_MS);
          }
          resolve();
        })
        .catch((err) => {
          if (state) {
            state.isManualRefreshing = false;
            state.intervalId = window.setInterval(() => {
              this.performAutoRefresh(layerId);
            }, this.AUTO_REFRESH_INTERVAL_MS);
          }
          reject(err);
        });
    });
  }

  /**
   * Gets the maximum selectable periods for a layer from configuration
   */
  private getMaxSelectablePeriods(layerId: string): number {
    const layer = this.layerService.getLayerById(layerId);
    if (
      layer &&
      layer.type === LayerType.TILE &&
      layer.availablePeriods &&
      layer.availablePeriods.length > 0
    ) {
      return Math.max(...layer.availablePeriods);
    }
    return 1;
  }

  /**
   * Checks if a layer has time-indexed data
   */
  private hasTimeData(layerId: string): boolean {
    return this.layerConfigService.hasConfig(layerId);
  }

  /**
   * Starts auto-refresh for a layer, showing initial count and setting up interval
   */
  private startAutoRefresh(layerId: string): void {
    if (this.refreshStates.has(layerId)) {
      return;
    }

    const initialTilesets = this.layerConfigService.getTilesets(layerId);
    const initialCount = initialTilesets.length;

    const state: RefreshState = {
      isManualRefreshing: false,
      lastRefreshTime: Date.now(),
      initialCount: initialCount,
    };

    const maxSelectable = this.getMaxSelectablePeriods(layerId);
    const displayCount = Math.min(initialCount, maxSelectable);
    const layerName = this.layerService.getLayerDisplayName(layerId);
    const message = `${displayCount} períodos disponibles para ${layerName}`;
    this.notificationService.show(NotificationType.SUCCESS, message);

    state.intervalId = window.setInterval(() => {
      this.performAutoRefresh(layerId);
    }, this.AUTO_REFRESH_INTERVAL_MS);

    this.refreshStates.set(layerId, state);
  }

  /**
   * Stops auto-refresh for a layer, clearing interval and removing state
   */
  private stopAutoRefresh(layerId: string): void {
    const state = this.refreshStates.get(layerId);
    if (!state) {
      return;
    }

    if (state.intervalId !== undefined) {
      window.clearInterval(state.intervalId);
    }

    this.refreshStates.delete(layerId);
  }

  /**
   * Performs the actual refresh check, silently handling errors
   */
  private async performAutoRefresh(layerId: string): Promise<void> {
    const state = this.refreshStates.get(layerId);
    if (!state || state.isManualRefreshing) {
      return;
    }

    try {
      await this.performRefreshAndCompare(layerId, false);
      if (state) {
        state.lastRefreshTime = Date.now();
      }
    } catch (err) {
      // Silently handle errors
    }
  }

  /**
   * Performs refresh and comparison logic (used by both auto and manual refresh)
   * Compares tilesets before/after and shows appropriate notifications
   */
  private performRefreshAndCompare(layerId: string, showNoChanges: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const parts = layerId.split('-');
      if (parts.length < 2) {
        reject(new Error('Invalid layer ID'));
        return;
      }

      const instrument = parts[0]; // 'abi' or 'glm'
      const product = 'goes-19';
      let channel: string;

      // Handle different layer ID formats
      if (instrument === 'abi') {
        // ABI format: abi-ch2 → ch-2
        const channelNumber = parts[1];
        channel = `ch-${channelNumber.replace('ch', '')}`;
      } else if (instrument === 'glm') {
        // GLM format: glm-fed → glm-fed
        channel = layerId; // Use full ID as channel name
      } else {
        reject(new Error(`Unknown instrument: ${instrument}`));
        return;
      }

      const maxSelectable = this.getMaxSelectablePeriods(layerId);

      const beforeAllTilesets = this.layerConfigService.getTilesets(layerId);
      const beforeTilesets = beforeAllTilesets.slice(-maxSelectable);

      this.layerConfigService.reloadChannelConfig(layerId, product, instrument, channel).subscribe({
        next: () => {
          const afterAllTilesets = this.layerConfigService.getTilesets(layerId);
          const afterTilesets = afterAllTilesets.slice(-maxSelectable);

          const beforeIds = new Set(beforeTilesets.map((t) => t.id));
          const afterIds = new Set(afterTilesets.map((t) => t.id));

          const added = afterTilesets.filter((t) => !beforeIds.has(t.id));
          const removed = beforeTilesets.filter((t) => !afterIds.has(t.id));

          const layerName = this.layerService.getLayerDisplayName(layerId);

          if (added.length > 0 || removed.length > 0) {
            let message: string;

            if (added.length > 0 && removed.length === 0) {
              message =
                added.length === 1
                  ? `1 período agregado para ${layerName}`
                  : `${added.length} períodos agregados para ${layerName}`;
            } else if (removed.length > 0 && added.length === 0) {
              message =
                removed.length === 1
                  ? `1 período eliminado para ${layerName}`
                  : `${removed.length} períodos eliminados para ${layerName}`;
            } else if (added.length === removed.length) {
              message =
                added.length === 1
                  ? `1 período modificado para ${layerName}`
                  : `${added.length} períodos modificados para ${layerName}`;
            } else {
              message = `${added.length} períodos agregados, ${removed.length} eliminados para ${layerName}`;
            }

            this.notificationService.show(NotificationType.INFO, message);
          } else if (showNoChanges) {
            this.notificationService.show(
              NotificationType.INFO,
              `No hay cambios para ${layerName}`,
            );
          }

          resolve();
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  }
}
