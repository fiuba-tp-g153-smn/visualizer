import { HttpClient } from '@angular/common/http';
import { Injectable, inject, effect, signal } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { LayerControlService } from './layer-control.service';
import { NotificationService } from '../notifications/notification.service';
import { SmnStationsAuthService } from '../auth/smn-stations-auth.service';
import {
  SMN_STATIONS_MAX_PAST_HOURS_OPTIONS,
  SmnStationsTemporalMode,
} from '../../config/layers/smn-stations/controls.constants';
import {
  LayerConfig,
  LayerType,
  LayerCategory,
  TileLayerConfig,
  NotificationType,
  TilesetEntry,
  SmnCurrentWeatherStationDto,
  SmnStationDto,
  SmnStationObservation,
  SmnStationSnapshot,
} from '../../models';

interface SmnStationsApiResponse {
  stations: SmnStationDto[];
  weather: SmnCurrentWeatherStationDto[];
}

interface SmnStationsEndpointConfig {
  tilesetIds: readonly string[];
  maxPastHoursOptions: readonly number[];
}

interface SmnStationsSnapshotMeta {
  fetchedAt: string;
}

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
  private readonly http = inject(HttpClient);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly layersService = inject(LayersService);
  private readonly notificationService = inject(NotificationService);
  private readonly layerControlService = inject(LayerControlService);
  private readonly smnStationsAuthService = inject(SmnStationsAuthService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 10_000;
  private readonly refreshTimers = new Map<string, number>();
  private readonly smnStationsSnapshotSignal = signal<SmnStationSnapshot | null>(null);
  private readonly smnStationsEndpointConfigSignal = signal<SmnStationsEndpointConfig | null>(null);
  private readonly smnStationsLoadTickSignal = signal(0);
  private readonly smnStationsBackupBasePath = '/testing/fixtures/smn-stations';
  private smnStationsInflight: Promise<SmnStationSnapshot> | null = null;

  readonly smnStationsLoadTick = this.smnStationsLoadTickSignal.asReadonly();

  constructor() {
    effect(() => {
      const activeLayers = this.layerControlService.activeLayers();
      const activeLayerIds = new Set(activeLayers.map((item) => item.layer.id));

      // Fetch config and start auto-refresh for newly active TILE layers
      for (const { layer } of activeLayers) {
        // Only TILE layers of GOES_19 and RADAR categories need config
        const needsConfig =
          layer.type === LayerType.TILE &&
          (layer.category === LayerCategory.GOES_19 ||
            layer.category === LayerCategory.RADAR ||
            layer.category === LayerCategory.ECMWF_TP);

        if (!needsConfig) {
          continue; // Skip layers that don't need config (e.g., WMS layers)
        }

        // If layer doesn't have config yet, fetch it first
        if (!this.layerConfigService.hasConfig(layer.id)) {
          this.layerConfigService.fetchLayerConfig(layer).subscribe({
            next: () => {
              this.startAutoRefresh(layer.id);
            },
            error: (err) => {
              console.error(`Failed to fetch config for ${layer.id}:`, err);
            },
          });
        }
        // If layer already has config and auto-refresh is not running, start it
        else if (!this.refreshTimers.has(layer.id)) {
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

  peekSmnStationsSnapshot(): SmnStationSnapshot | null {
    return this.smnStationsSnapshotSignal();
  }

  getSmnStationsAvailableTilesetIds(): readonly string[] {
    return this.smnStationsEndpointConfigSignal()?.tilesetIds ?? [];
  }

  getSmnStationsMaxPastHoursOptions(): readonly number[] {
    return this.smnStationsEndpointConfigSignal()?.maxPastHoursOptions ?? [];
  }

  async ensureSmnStationsEndpointConfigLoaded(): Promise<void> {
    if (this.smnStationsEndpointConfigSignal()) {
      return;
    }

    const token = await this.resolveSmnStationsTokenIfRequired();
    const config = await this.fetchSmnStationsEndpointConfig(token);
    this.smnStationsEndpointConfigSignal.set(config);
    this.syncSmnStationsTemporalControlsWithConfig(config);
  }

  async loadSmnStationsSnapshot(force = false): Promise<SmnStationSnapshot> {
    const currentSnapshot = this.smnStationsSnapshotSignal();
    if (!force && currentSnapshot) {
      return currentSnapshot;
    }

    if (this.smnStationsInflight) {
      return this.smnStationsInflight;
    }

    this.smnStationsInflight = this.fetchSmnStationsSnapshot();
    try {
      const snapshot = await this.smnStationsInflight;
      this.smnStationsSnapshotSignal.set(snapshot);
      this.smnStationsLoadTickSignal.update((value) => value + 1);
      return snapshot;
    } finally {
      this.smnStationsInflight = null;
    }
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

  private async fetchSmnStationsSnapshot(): Promise<SmnStationSnapshot> {
    const token = await this.resolveSmnStationsTokenIfRequired();
    const temporalMode = this.layerControlService.getSmnStationsTemporalMode();

    try {
      const endpointConfig = await this.fetchSmnStationsEndpointConfig(token);
      this.smnStationsEndpointConfigSignal.set(endpointConfig);
      this.syncSmnStationsTemporalControlsWithConfig(endpointConfig);

      const requestedTilesetId = this.resolveRequestedSmnStationsTilesetId(
        endpointConfig.tilesetIds,
      );
      const maxPastHours = this.layerControlService.getSmnStationsMaxPastHours();

      const response =
        temporalMode === SmnStationsTemporalMode.SPECIFIC
          ? await this.fetchSmnStationsTilesetSnapshot(token, requestedTilesetId, maxPastHours)
          : await this.fetchSmnStationsLatestSnapshot(token);

      const snapshotSource =
        temporalMode === SmnStationsTemporalMode.SPECIFIC ? 'mock-tileset' : 'mock-latest';
      const observations = this.toSmnStationsObservations(response.stations, response.weather);

      if (observations.length > 0) {
        return {
          observations,
          fetchedAt: new Date().toISOString(),
          source: snapshotSource,
        };
      }
    } catch (error) {
      console.warn('[LayerRefreshService] failed to load SMN stations fallback JSON', {
        error,
      });
    }

    return {
      observations: [],
      fetchedAt: new Date().toISOString(),
      source: temporalMode === SmnStationsTemporalMode.SPECIFIC ? 'mock-tileset' : 'mock-latest',
    };
  }

  private async resolveSmnStationsTokenIfRequired(): Promise<string | null> {
    return this.smnStationsAuthService.getValidToken();
  }

  private async fetchSmnStationsEndpointConfig(
    token: string | null,
  ): Promise<SmnStationsEndpointConfig> {
    void token;

    const backupConfig = await this.fetchSmnStationsBackupEndpointConfig();
    if (backupConfig) {
      return backupConfig;
    }

    const latest = await this.fetchSmnStationsBackupLatestResponse();
    if (latest) {
      return this.buildSmnStationsEndpointConfigFromWeather(latest.weather);
    }

    return this.buildDefaultSmnStationsEndpointConfig();
  }

  private async fetchSmnStationsLatestSnapshot(
    token: string | null,
  ): Promise<SmnStationsApiResponse> {
    void token;

    const backupResponse = await this.fetchSmnStationsBackupLatestResponse();
    if (backupResponse) {
      return backupResponse;
    }

    throw new Error('SMN latest fallback JSON is unavailable');
  }

  private async fetchSmnStationsTilesetSnapshot(
    token: string | null,
    tilesetId: string,
    maxPastHours: number,
  ): Promise<SmnStationsApiResponse> {
    void token;
    const backupResponse = await this.fetchSmnStationsBackupLatestResponse();
    if (backupResponse) {
      return this.filterSmnStationsResponseByWindow(backupResponse, tilesetId, maxPastHours);
    }

    throw new Error('SMN tileset fallback JSON is unavailable');
  }

  private async fetchSmnStationsBackupEndpointConfig(): Promise<SmnStationsEndpointConfig | null> {
    try {
      const meta = await firstValueFrom(
        this.http.get<SmnStationsSnapshotMeta>(
          `${this.smnStationsBackupBasePath}/snapshot.meta.json`,
        ),
      );

      const fetchedAtDate = new Date(meta.fetchedAt);
      if (Number.isNaN(fetchedAtDate.getTime())) {
        return null;
      }

      return {
        tilesetIds: [this.toSmnStationsTilesetId(fetchedAtDate)],
        maxPastHoursOptions: [...SMN_STATIONS_MAX_PAST_HOURS_OPTIONS],
      };
    } catch {
      return null;
    }
  }

  private async fetchSmnStationsBackupLatestResponse(): Promise<SmnStationsApiResponse | null> {
    return this.fetchSmnStationsBackupApiResponse(
      `${this.smnStationsBackupBasePath}/stations.latest.json`,
      `${this.smnStationsBackupBasePath}/weather.latest.json`,
    );
  }

  private async fetchSmnStationsBackupApiResponse(
    stationsUrl: string,
    weatherUrl: string,
  ): Promise<SmnStationsApiResponse | null> {
    try {
      const [stations, weather] = await Promise.all([
        firstValueFrom(this.http.get<SmnStationDto[]>(stationsUrl)),
        firstValueFrom(this.http.get<SmnCurrentWeatherStationDto[]>(weatherUrl)),
      ]);

      if (!Array.isArray(stations) || !Array.isArray(weather)) {
        return null;
      }

      return { stations, weather };
    } catch {
      return null;
    }
  }

  private toSmnStationsObservations(
    stations: readonly SmnStationDto[],
    weather: readonly SmnCurrentWeatherStationDto[],
  ): SmnStationObservation[] {
    const weatherByStation = new Map<number, SmnCurrentWeatherStationDto>();
    for (const entry of weather) {
      weatherByStation.set(entry.station_id, entry);
    }

    return stations
      .map((station) => {
        const currentWeather = weatherByStation.get(station.id);
        if (!currentWeather) {
          return null;
        }
        return { station, weather: currentWeather } satisfies SmnStationObservation;
      })
      .filter((entry): entry is SmnStationObservation => entry !== null)
      .sort((a, b) => a.station.name.localeCompare(b.station.name, 'es'));
  }

  private buildDefaultSmnStationsEndpointConfig(): SmnStationsEndpointConfig {
    const now = Date.now();
    const totalHours = 72;
    const tilesetIds = Array.from({ length: totalHours + 1 }, (_, index) => {
      const timestamp = new Date(now - (totalHours - index) * 60 * 60 * 1000);
      return this.toSmnStationsTilesetId(timestamp);
    });

    return {
      tilesetIds,
      maxPastHoursOptions: [...SMN_STATIONS_MAX_PAST_HOURS_OPTIONS],
    };
  }

  private filterSmnStationsResponseByWindow(
    latest: SmnStationsApiResponse,
    tilesetId: string,
    maxPastHours: number,
  ): SmnStationsApiResponse {
    const requestedTimestamp = this.fromSmnStationsTilesetId(tilesetId) ?? new Date();
    const minTimestamp = new Date(requestedTimestamp.getTime() - maxPastHours * 60 * 60 * 1000);

    const filteredWeather = latest.weather.filter((entry) => {
      const entryTimestamp = new Date(entry.date);
      return entryTimestamp >= minTimestamp && entryTimestamp <= requestedTimestamp;
    });

    if (filteredWeather.length === 0) {
      return latest;
    }

    const allowedStationIds = new Set(filteredWeather.map((entry) => entry.station_id));
    return {
      stations: latest.stations.filter((station) => allowedStationIds.has(station.id)),
      weather: filteredWeather,
    };
  }

  private syncSmnStationsTemporalControlsWithConfig(config: SmnStationsEndpointConfig): void {
    const selectedTilesetId = this.resolveRequestedSmnStationsTilesetId(config.tilesetIds);
    this.layerControlService.setSmnStationsSelectedTilesetId(selectedTilesetId);
  }

  private resolveRequestedSmnStationsTilesetId(tilesetIds: readonly string[]): string {
    const selectedTilesetId = this.layerControlService.getSmnStationsSelectedTilesetId();
    if (selectedTilesetId && tilesetIds.includes(selectedTilesetId)) {
      return selectedTilesetId;
    }
    return tilesetIds[tilesetIds.length - 1];
  }

  private toSmnStationsTilesetId(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}${month}${day}T${hour}00Z`;
  }

  private fromSmnStationsTilesetId(tilesetId: string): Date | null {
    const match = tilesetId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})00Z$/);
    if (!match) {
      return null;
    }

    const [, year, month, day, hour] = match;
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), 0, 0),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private buildSmnStationsEndpointConfigFromWeather(
    weather: readonly SmnCurrentWeatherStationDto[],
  ): SmnStationsEndpointConfig {
    const dateCandidates = weather
      .map((entry) => new Date(entry.date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const lastDate = dateCandidates.at(-1) ?? new Date();
    return {
      tilesetIds: [this.toSmnStationsTilesetId(lastDate)],
      maxPastHoursOptions: [...SMN_STATIONS_MAX_PAST_HOURS_OPTIONS],
    };
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
      case LayerType.TILE:
        count = config.availableTilesets.length;
        break;
    }

    if (count > 0) {
      const message = `${count} período${count !== 1 ? 's' : ''} disponible${count !== 1 ? 's' : ''} para ${layerName}`;
      this.notificationService.show(NotificationType.SUCCESS, message);
    }
  }

  /**
   * Compares before and after configurations and shows appropriate notification.
   * If there are changes, adjusts the timeIndex based on lastImagesCount.
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
    let hasChanges = false;

    switch (after.type) {
      case LayerType.TILE:
        const beforeTilesets = (before as TileLayerConfig).availableTilesets;
        const afterTilesets = after.availableTilesets;
        const diff = this.calculateDiff(beforeTilesets, afterTilesets);
        this.showDiffNotification(layerName, diff, showNoChanges);
        hasChanges = diff.added > 0 || diff.removed > 0;
        break;
    }

    // If there were changes, adjust timeIndex based on lastImagesCount
    if (hasChanges) {
      this.adjustTimeIndexAfterConfigRefresh(layerId);
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
        this.notificationService.show(NotificationType.INFO, `Sin cambios para ${layerName}`);
      }
      return;
    }

    let message: string;

    switch (true) {
      case diff.added > 0 && diff.removed === 0: {
        const plural = diff.added !== 1 ? 's' : '';
        message = `${diff.added} período${plural} agregado${plural} para ${layerName}`;
        break;
      }
      case diff.removed > 0 && diff.added === 0: {
        const plural = diff.removed !== 1 ? 's' : '';
        message = `${diff.removed} período${plural} eliminado${plural} para ${layerName}`;
        break;
      }
      case diff.added === diff.removed: {
        const plural = diff.added !== 1 ? 's' : '';
        message = `${diff.added} período${plural} modificado${plural} para ${layerName}`;
        break;
      }
      default: {
        message = `${diff.added} período${diff.added !== 1 ? 's' : ''} agregado${diff.added !== 1 ? 's' : ''}, ${diff.removed} eliminado${diff.removed !== 1 ? 's' : ''} para ${layerName}`;
        break;
      }
    }

    this.notificationService.show(NotificationType.INFO, message);
  }

  /**
   * Adjusts the timeIndex after a config refresh based on lastImagesCount.
   * Also handles clamping if the timeIndex is out of bounds.
   * Delegates calculation to LayerConfigService.
   */
  private adjustTimeIndexAfterConfigRefresh(layerId: string): void {
    const controls = this.layerControlService.getControls(layerId);
    if (!controls || controls.type !== LayerType.TILE) {
      return;
    }

    const config = this.layerConfigService.getConfig(layerId);
    if (!config || config.type !== LayerType.TILE) {
      return;
    }

    const maxIndex = config.availableTilesets.length - 1;
    const currentIndex = controls.playback.timeIndex;

    // If current timeIndex is out of bounds, clamp it
    if (currentIndex !== undefined && (currentIndex > maxIndex || currentIndex < 0)) {
      const clampedIndex = Math.max(0, Math.min(currentIndex, maxIndex));
      this.layerControlService.setTimeIndex(layerId, clampedIndex);
      return;
    }

    // Otherwise, recalculate based on lastImagesCount
    const lastImagesCount = controls.playback.lastImagesCount;
    const newTimeIndex = this.layerConfigService.calculateTimeIndexForRange(
      layerId,
      lastImagesCount,
    );

    if (newTimeIndex !== undefined) {
      this.layerControlService.setTimeIndex(layerId, newTimeIndex);
    }
  }

  // ============================================================================
  // Private Helpers - Diff Calculations
  // ============================================================================

  /**
   * Calculates the difference between two arrays of tileset IDs.
   */
  private calculateDiff(
    before: TilesetEntry[],
    after: TilesetEntry[],
  ): { added: number; removed: number } {
    const beforeSet = new Set(before.map((e) => e.id));
    const afterSet = new Set(after.map((e) => e.id));

    const added = after.filter((e) => !beforeSet.has(e.id)).length;
    const removed = before.filter((e) => !afterSet.has(e.id)).length;

    return { added, removed };
  }
}
