import { Injectable, inject, effect, Signal, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError } from 'rxjs';
import { buildChannelConfigUrl } from '../../config/backend.config';
import { NotificationService } from '../notifications/notification.service';
import { LayersService } from './layers.service';
import { LayerControlService } from './layer-control.service';
import { Layer, LayerConfig, LayerCategory, NotificationType } from '../../models';

interface RefreshState {
  intervalId?: number;
  isManualRefreshing: boolean;
  lastRefreshTime: number;
  initialCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class LayerConfigService {
  private readonly layersService = inject(LayersService);
  private readonly layerControl = inject(LayerControlService);
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 10 * 1000;
  private configMap = signal<Map<string, LayerConfig>>(new Map());
  private refreshStates = new Map<string, RefreshState>();

  constructor() {
    effect(() => {
      const activeLayers = this.layerControl.activeLayers();
      const activeLayerIds = new Set(activeLayers.map((item) => item.layer.id));

      for (const { layer } of activeLayers) {
        if (this.hasConfig(layer.id) && !this.refreshStates.has(layer.id)) {
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

  loadConfig(layer: Layer): Observable<any> {
    const layer_category = layer.category;

    if (layer_category === LayerCategory.RADAR) {
      const [radarPart, variable] = layer.id.split('-');
      const radarId = radarPart.toUpperCase();
      const variableId = variable.toUpperCase();
      const elevationId = 'elev0';
      return this.loadRadarConfig(layer.id, radarId, variableId, elevationId);
    }

    if (layer_category === LayerCategory.GOES_19) {
      const [instrument, channelPart] = layer.id.split('-');
      const product = 'goes-19';
      let channel: string;

      if (instrument === 'abi') {
        const channelNumber = channelPart;
        channel = `ch-${channelNumber.replace('ch', '')}`;
      } else if (instrument === 'glm') {
        channel = layer.id;
      } else {
        throw new Error(`Unknown instrument: ${instrument}`);
      }

      return this.loadChannelConfig(layer.id, product, instrument, channel);
    }

    throw new Error(`Layer category ${layer_category} does not require tileset configuration`);
  }

  loadChannelConfig(
    layerId: string,
    product: string,
    instrument: string,
    channel: string,
  ): Observable<any> {
    const productPath = `${product}/${instrument}/${channel}`;
    const url = buildChannelConfigUrl(productPath);

    return this.http.get<any>(url).pipe(
      tap((config: any) => {
        if (config.tilesets && config.tilesets.length > 0) {
          config.tilesets.sort((a: any, b: any) => {
            const matchA = a.id.match(/_s(\d+)/);
            const matchB = b.id.match(/_s(\d+)/);
            if (matchA && matchB) {
              return matchA[1].localeCompare(matchB[1]);
            }
            return a.id.localeCompare(b.id);
          });
        }

        this.configMap.set(layerId, config);
      }),
      catchError((error: any) => {
        console.error(`Error loading config for ${layerId}:`, error);
        const layerName = this.layersService.getLayerDisplayName(layerId);
        this.notificationService.error(
          `Error loading ${layerName}: could not retrieve server configuration`,
        );
        throw error;
      }),
    );
  }

  loadRadarConfig(
    layerId: string,
    radarId: string,
    variableId: string,
    elevationId: string,
  ): Observable<any> {
    const productPath = `radar/${radarId}/${variableId}/${elevationId}`;
    const url = buildChannelConfigUrl(productPath);

    return this.http.get<any>(url).pipe(
      tap((config: any) => {
        if (config.tilesets && config.tilesets.length > 0) {
          config.tilesets.sort((a: any, b: any) => {
            const matchA = a.id.match(/_s(\d+)/);
            const matchB = b.id.match(/_s(\d+)/);
            if (matchA && matchB) {
              return matchA[1].localeCompare(matchB[1]);
            }
            return a.id.localeCompare(b.id);
          });
        }

        this.configMap.set(layerId, config);
      }),
      catchError((error: any) => {
        console.error(`Error loading radar config for ${layerId}:`, error);
        const layerName = this.layersService.getLayerDisplayName(layerId);
        this.notificationService.error(
          `Error loading ${layerName}: could not retrieve server configuration`,
        );
        throw error;
      }),
    );
  }

  manualRefresh(layerId: string): Promise<void> {
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

  getConfig(layerId: string): LayerConfig | null {
    return this.configMap().get(layerId) || null;
  }

  getTilesets(layerId: string): any[] {
    return this.getConfig(layerId)?.tilesets || [];
  }

  buildTileUrl(layerId: string, tilesetIndex: number): string | null {
    const config = this.getConfig(layerId);
    if (!config || !config.tilesets[tilesetIndex]) {
      return null;
    }

    const tileset = config.tilesets[tilesetIndex];
    const pattern = config.tile_url_pattern;

    if (!pattern) {
      return null;
    }

    return pattern.replace('{tileset_id}', tileset.id);
  }

  hasConfig(layerId: string): boolean {
    return this.configMap.has(layerId);
  }

  private getMaxSelectablePeriods(layerId: string): number {
    const layer = this.layersService.getLayerById(layerId);
    if (
      layer &&
      layer.type === 'tile' &&
      layer.availablePeriods &&
      layer.availablePeriods.length > 0
    ) {
      return Math.max(...layer.availablePeriods);
    }
    return 1;
  }

  private startAutoRefresh(layerId: string): void {
    if (this.refreshStates.has(layerId)) {
      return;
    }

    const initialTilesets = this.getTilesets(layerId);
    const initialCount = initialTilesets.length;

    const state: RefreshState = {
      isManualRefreshing: false,
      lastRefreshTime: Date.now(),
      initialCount: initialCount,
    };

    const maxSelectable = this.getMaxSelectablePeriods(layerId);
    const displayCount = Math.min(initialCount, maxSelectable);
    const layerName = this.layersService.getLayerDisplayName(layerId);
    const message = `${displayCount} periods available for ${layerName}`;
    this.notificationService.show(NotificationType.SUCCESS, message);

    state.intervalId = window.setInterval(() => {
      this.performAutoRefresh(layerId);
    }, this.AUTO_REFRESH_INTERVAL_MS);

    this.refreshStates.set(layerId, state);
  }

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

  private performRefreshAndCompare(layerId: string, showNoChanges: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const layer = this.layersService.getLayerById(layerId);
      if (!layer) {
        reject(new Error('Layer not found'));
        return;
      }

      const maxSelectable = this.getMaxSelectablePeriods(layerId);
      const beforeAllTilesets = this.getTilesets(layerId);
      const beforeTilesets = beforeAllTilesets.slice(-maxSelectable);

      this.loadConfig(layer).subscribe({
        next: () => {
          const afterAllTilesets = this.getTilesets(layerId);
          const afterTilesets = afterAllTilesets.slice(-maxSelectable);

          const beforeIds = new Set(beforeTilesets.map((t: any) => t.id));
          const afterIds = new Set(afterTilesets.map((t: any) => t.id));

          const added = afterTilesets.filter((t: any) => !beforeIds.has(t.id));
          const removed = beforeTilesets.filter((t: any) => !afterIds.has(t.id));

          const layerName = this.layersService.getLayerDisplayName(layerId);

          if (added.length > 0 || removed.length > 0) {
            let message: string;

            if (added.length > 0 && removed.length === 0) {
              message =
                added.length === 1
                  ? `1 period added for ${layerName}`
                  : `${added.length} periods added for ${layerName}`;
            } else if (removed.length > 0 && added.length === 0) {
              message =
                removed.length === 1
                  ? `1 period removed for ${layerName}`
                  : `${removed.length} periods removed for ${layerName}`;
            } else if (added.length === removed.length) {
              message =
                added.length === 1
                  ? `1 period modified for ${layerName}`
                  : `${added.length} periods modified for ${layerName}`;
            } else {
              message = `${added.length} periods added, ${removed.length} removed for ${layerName}`;
            }

            this.notificationService.show(NotificationType.INFO, message);
          } else if (showNoChanges) {
            this.notificationService.show(NotificationType.INFO, `No changes for ${layerName}`);
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
