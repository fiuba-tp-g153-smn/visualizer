import { Injectable, effect, inject, signal } from '@angular/core';
import { LayerService } from './layer.service';
import { ChannelConfigService } from './channel-config.service';
import { NotificationService } from './notification.service';
import { NotificationType } from '../models';

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
  private readonly channelConfigService = inject(ChannelConfigService);
  private readonly notificationService = inject(NotificationService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute
  private refreshStates = new Map<string, RefreshState>();

  /**
   * Gets the maximum selectable periods for a layer from the layer configuration
   */
  private getMaxSelectablePeriods(layerId: string): number {
    // Find the layer in all layer groups
    const layerGroups = this.layerService.layerGroups();
    for (const group of layerGroups) {
      for (const subgroup of group.subgroups) {
        const layer = subgroup.layers.find((l) => l.id === layerId);
        if (layer?.availablePeriods && layer.availablePeriods.length > 0) {
          return Math.max(...layer.availablePeriods);
        }
      }
    }
    // Default to 1 if not configured
    return 1;
  }

  constructor() {
    // Monitor active layers and start/stop auto-refresh accordingly
    effect(() => {
      const activeLayers = this.layerService.activeLayers();
      const activeLayerIds = new Set(activeLayers.map((l) => l.id));

      // Start refresh for newly active time-indexed layers
      for (const layer of activeLayers) {
        if (this.hasTimeData(layer.id) && !this.refreshStates.has(layer.id)) {
          this.startAutoRefresh(layer.id);
        }
      }

      // Stop refresh for layers that are no longer active
      for (const layerId of this.refreshStates.keys()) {
        if (!activeLayerIds.has(layerId)) {
          this.stopAutoRefresh(layerId);
        }
      }
    });
  }

  /**
   * Checks if a layer has time-indexed data
   */
  private hasTimeData(layerId: string): boolean {
    return this.channelConfigService.hasConfig(layerId);
  }

  /**
   * Starts auto-refresh for a layer
   */
  private startAutoRefresh(layerId: string): void {
    if (this.refreshStates.has(layerId)) {
      return; // Already running
    }

    // Get initial count
    const initialTilesets = this.channelConfigService.getTilesets(layerId);
    const initialCount = initialTilesets.length;

    const state: RefreshState = {
      isManualRefreshing: false,
      lastRefreshTime: Date.now(),
      initialCount: initialCount,
    };

    // Show initial available periods (capped at max selectable)
    const maxSelectable = this.getMaxSelectablePeriods(layerId);
    const displayCount = Math.min(initialCount, maxSelectable);
    const message = `${displayCount} períodos disponibles para ${this.getLayerDisplayName(layerId)}`;
    this.notificationService.show(NotificationType.SUCCESS, message);

    // Set up periodic refresh
    state.intervalId = window.setInterval(() => {
      this.performAutoRefresh(layerId);
    }, this.AUTO_REFRESH_INTERVAL_MS);

    this.refreshStates.set(layerId, state);
  }

  /**
   * Stops auto-refresh for a layer
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
   * Performs the actual refresh check
   */
  private async performAutoRefresh(layerId: string): Promise<void> {
    const state = this.refreshStates.get(layerId);
    if (!state || state.isManualRefreshing) {
      return; // Skip if manual refresh is in progress
    }

    // Get current tilesets before refresh
    const beforeTilesets = this.channelConfigService.getTilesets(layerId);
    const beforeCount = beforeTilesets.length;

    // Parse layer details
    const parts = layerId.split('-');
    if (parts.length < 2) return;

    const instrument = parts[0];
    const channelNumber = parts[1];
    const channel = `ch-${channelNumber.replace('ch', '')}`;
    const product = 'goes-19';

    // Reload configuration
    this.channelConfigService.reloadChannelConfig(layerId, product, instrument, channel).subscribe({
      next: () => {
        // Compare with new tilesets
        const afterTilesets = this.channelConfigService.getTilesets(layerId);
        const afterCount = afterTilesets.length;

        const diff = afterCount - beforeCount;
        const layerName = this.getLayerDisplayName(layerId);

        if (diff !== 0) {
          let message: string;

          if (diff > 0) {
            // Periods added
            const maxSelectable = this.getMaxSelectablePeriods(layerId);
            const displayDiff =
              Math.min(afterCount, maxSelectable) - Math.min(beforeCount, maxSelectable);
            if (displayDiff > 0) {
              message =
                displayDiff === 1
                  ? `1 período agregado para ${layerName}`
                  : `${displayDiff} períodos agregados para ${layerName}`;
            } else {
              // All new periods are beyond the max selectable, don't notify

              if (state) {
                state.lastRefreshTime = Date.now();
              }
              return;
            }
          } else {
            // Periods removed
            const removed = Math.abs(diff);
            message =
              removed === 1
                ? `1 período eliminado para ${layerName}`
                : `${removed} períodos eliminados para ${layerName}`;
          }

          this.notificationService.show(NotificationType.INFO, message);
        }

        // Update last refresh time
        if (state) {
          state.lastRefreshTime = Date.now();
        }
      },
      error: (err) => {
        console.error(`❌ [LayerReload] Error refreshing ${layerId}:`, err);
      },
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
        // Layer not being auto-refreshed, just do a simple refresh
        this.performManualRefreshOnly(layerId, true).then(resolve).catch(reject);
        return;
      }

      // Prevent concurrent refreshes
      if (state.isManualRefreshing) {
        resolve();
        return;
      }

      state.isManualRefreshing = true;

      // Clear the existing interval
      if (state.intervalId !== undefined) {
        window.clearInterval(state.intervalId);
      }

      // Perform refresh
      this.performManualRefreshOnly(layerId, true)
        .then(() => {
          // Reset the timer with a new interval
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
            // Restart interval even on error
            state.intervalId = window.setInterval(() => {
              this.performAutoRefresh(layerId);
            }, this.AUTO_REFRESH_INTERVAL_MS);
          }
          reject(err);
        });
    });
  }

  /**
   * Performs a manual refresh without checking state (used for non-monitored layers)
   */
  private performManualRefreshOnly(
    layerId: string,
    showNoChangesNotification = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const parts = layerId.split('-');
      if (parts.length < 2) {
        reject(new Error('Invalid layer ID'));
        return;
      }

      const instrument = parts[0];
      const channelNumber = parts[1];
      const channel = `ch-${channelNumber.replace('ch', '')}`;
      const product = 'goes-19';

      // Get current count before refresh for comparison
      const beforeCount = this.channelConfigService.getTilesets(layerId).length;

      this.channelConfigService
        .reloadChannelConfig(layerId, product, instrument, channel)
        .subscribe({
          next: () => {
            // Check if there were changes
            const afterCount = this.channelConfigService.getTilesets(layerId).length;
            if (showNoChangesNotification && beforeCount === afterCount) {
              const layerName = this.getLayerDisplayName(layerId);
              this.notificationService.show(
                NotificationType.ERROR,
                `No hay cambios para ${layerName}`,
              );
            }
            resolve();
          },
          error: (err) => {
            console.error(`❌ [LayerReload] Manual refresh error for ${layerId}:`, err);
            reject(err);
          },
        });
    });
  }

  /**
   * Gets a human-readable layer display name
   */
  private getLayerDisplayName(layerId: string): string {
    // Simple extraction - could be enhanced to look up from layer definitions
    const parts = layerId.split('-');
    if (parts.length >= 2) {
      return `${parts[0].toUpperCase()} ${parts[1].toUpperCase()}`;
    }
    return layerId;
  }

  /**
   * Get refresh state for debugging
   */
  public getRefreshState(layerId: string): RefreshState | undefined {
    return this.refreshStates.get(layerId);
  }
}
