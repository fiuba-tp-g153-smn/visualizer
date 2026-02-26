import { Injectable, inject, effect } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { LayerControlService } from './layer-control.service';
import { NotificationService } from '../notifications/notification.service';
import {
  LayerConfig,
  LayerType,
  LayerCategory,
  GoesTileLayerConfig,
  RadarTileLayerConfig,
  NotificationType,
} from '../../models';

/**
 * Service responsible for managing layer configuration refresh cycles and notifications.
 *
 * This service handles:
 * - Automatic periodic refresh of layer configurations for active layers
 * - Manual refresh triggered by user interactions
 * - Comparison of before/after configurations to detect changes
 * - User notifications about configuration updates (periods added/removed/modified)
 *
 * The service automatically starts/stops refresh timers based on layer activation state,
 * ensuring efficient resource usage.
 */
@Injectable({
  providedIn: 'root',
})
export class LayerRefreshService {
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly layersService = inject(LayersService);
  private readonly notificationService = inject(NotificationService);
  private readonly layerControlService = inject(LayerControlService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 10_000;
  private readonly refreshTimers = new Map<string, number>();

  constructor() {
    effect(() => {
      const activeLayers = this.layerControlService.activeLayers();
      const activeLayerIds = new Set(activeLayers.map((item) => item.layer.id));

      // Start auto-refresh for newly active layers that have configs
      for (const { layer } of activeLayers) {
        if (this.layerConfigService.hasConfig(layer.id) && !this.refreshTimers.has(layer.id)) {
          this.startAutoRefresh(layer.id);
        }
      }

      // Stop auto-refresh for layers that are no longer active
      for (const layerId of this.refreshTimers.keys()) {
        if (!activeLayerIds.has(layerId)) {
          this.stopAutoRefresh(layerId);
        }
      }
    });
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Manually refreshes the configuration for a layer and shows notifications.
   * Always shows notifications, including "No changes" if nothing changed.
   */
  manualRefresh(layerId: string): Observable<void> {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) {
      return throwError(() => new Error('Layer not found'));
    }

    const beforeConfig = this.layerConfigService.getConfig(layerId);

    return this.layerConfigService.fetchLayerConfig(layer).pipe(
      map(() => {
        const afterConfig = this.layerConfigService.getConfig(layerId);
        this.compareAndNotify(layerId, beforeConfig, afterConfig, true);
      }),
    );
  }
  // ============================================================================
  // Private Helpers - Auto-refresh
  // ============================================================================

  /**
   * Starts automatic refresh for a layer.
   * Shows an initial notification with the count of available periods.
   */
  private startAutoRefresh(layerId: string): void {
    if (this.refreshTimers.has(layerId)) {
      return;
    }

    const timerId = window.setInterval(() => {
      this.performAutoRefresh(layerId);
    }, this.AUTO_REFRESH_INTERVAL_MS);

    this.refreshTimers.set(layerId, timerId);

    this.showInitialNotification(layerId);
  }

  /**
   * Stops automatic refresh for a layer and clears the timer.
   */
  private stopAutoRefresh(layerId: string): void {
    const timerId = this.refreshTimers.get(layerId);
    if (timerId !== undefined) {
      window.clearInterval(timerId);
      this.refreshTimers.delete(layerId);
    }
  }

  /**
   * Performs an automatic refresh for a layer.
   * Silently handles errors and only shows notifications if changes are detected.
   */
  private performAutoRefresh(layerId: string): void {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) {
      return;
    }

    const beforeConfig = this.layerConfigService.getConfig(layerId);

    this.layerConfigService.fetchLayerConfig(layer).subscribe({
      next: () => {
        const afterConfig = this.layerConfigService.getConfig(layerId);
        this.compareAndNotify(layerId, beforeConfig, afterConfig, false);
      },
      error: (err) => {
        console.error(`Auto-refresh failed for ${layerId}:`, err);
      },
    });
  }

  // ============================================================================
  // Private Helpers - Notifications
  // ============================================================================

  /**
   * Shows initial notification when a layer is activated with the count of available periods.
   */
  private showInitialNotification(layerId: string): void {
    const config = this.layerConfigService.getConfig(layerId);
    if (!config) {
      return;
    }

    const layerName = this.layersService.getLayerDisplayName(layerId);
    let count = 0;

    switch (config.type) {
      case LayerType.TILE: {
        switch (config.category) {
          case LayerCategory.GOES_19: {
            count = config.availableTilesets.length;
            break;
          }
          case LayerCategory.RADAR: {
            count = Object.values(config.availableTilesetsByElevation).reduce(
              (total, tilesets) => total + tilesets.length,
              0,
            );
            break;
          }
        }
        break;
      }
    }

    if (count > 0) {
      const message = `${count} period${count !== 1 ? 's' : ''} available for ${layerName}`;
      this.notificationService.show(NotificationType.SUCCESS, message);
    }
  }

  /**
   * Compares before and after configurations and shows appropriate notification.
   */
  private compareAndNotify(
    layerId: string,
    before: LayerConfig | undefined,
    after: LayerConfig | undefined,
    showNoChanges: boolean,
  ): void {
    if (!before || !after) {
      return;
    }

    const layerName = this.layersService.getLayerDisplayName(layerId);

    switch (after.type) {
      case LayerType.TILE: {
        switch (after.category) {
          case LayerCategory.GOES_19: {
            const beforeTilesets = (before as GoesTileLayerConfig).availableTilesets;
            const afterTilesets = after.availableTilesets;
            const diff = this.calculateDiff(beforeTilesets, afterTilesets);
            this.showDiffNotification(layerName, diff, showNoChanges);
            break;
          }
          case LayerCategory.RADAR: {
            const beforeByElevation = (before as RadarTileLayerConfig).availableTilesetsByElevation;
            const afterByElevation = after.availableTilesetsByElevation;
            const diff = this.calculateRadarDiff(beforeByElevation, afterByElevation);
            this.showDiffNotification(layerName, diff, showNoChanges);
            break;
          }
        }
        break;
      }
    }
  }

  /**
   * Shows a notification about configuration changes.
   * If showNoChanges is true, shows a notification even when there are no changes.
   */
  private showDiffNotification(
    layerName: string,
    diff: { added: number; removed: number },
    showNoChanges: boolean,
  ): void {
    if (diff.added === 0 && diff.removed === 0) {
      if (showNoChanges) {
        this.notificationService.show(NotificationType.INFO, `No changes for ${layerName}`);
      }
      return;
    }

    let message: string;

    switch (true) {
      case diff.added > 0 && diff.removed === 0: {
        const plural = diff.added !== 1 ? 's' : '';
        message = `${diff.added} period${plural} added for ${layerName}`;
        break;
      }
      case diff.removed > 0 && diff.added === 0: {
        const plural = diff.removed !== 1 ? 's' : '';
        message = `${diff.removed} period${plural} removed for ${layerName}`;
        break;
      }
      case diff.added === diff.removed: {
        const plural = diff.added !== 1 ? 's' : '';
        message = `${diff.added} period${plural} modified for ${layerName}`;
        break;
      }
      default: {
        message = `${diff.added} period${diff.added !== 1 ? 's' : ''} added, ${diff.removed} removed for ${layerName}`;
        break;
      }
    }

    this.notificationService.show(NotificationType.INFO, message);
  }

  // ============================================================================
  // Private Helpers - Diff Calculations
  // ============================================================================

  /**
   * Calculates the difference between two arrays of tileset IDs.
   */
  private calculateDiff(before: string[], after: string[]): { added: number; removed: number } {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    const added = after.filter((id) => !beforeSet.has(id)).length;
    const removed = before.filter((id) => !afterSet.has(id)).length;

    return { added, removed };
  }

  /**
   * Calculates the difference for radar layers across all elevation angles.
   */
  private calculateRadarDiff(
    before: Record<string, string[]>,
    after: Record<string, string[]>,
  ): { added: number; removed: number } {
    let totalAdded = 0;
    let totalRemoved = 0;

    const allElevations = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const elevation of allElevations) {
      const beforeTilesets = before[elevation] || [];
      const afterTilesets = after[elevation] || [];
      const diff = this.calculateDiff(beforeTilesets, afterTilesets);
      totalAdded += diff.added;
      totalRemoved += diff.removed;
    }

    return { added: totalAdded, removed: totalRemoved };
  }
}
