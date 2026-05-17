import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, effect, signal } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  buildWeatherStationsLatestUrl,
  buildWeatherStationsRegistryUrl,
  buildWeatherStationsTilesetUrl,
  buildWeatherStationsTilesetsUrl,
} from '../../config/backend.config';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { LayerControlService } from './layer-control.service';
import { NotificationService } from '../notifications/notification.service';
import { WeatherStationsApiKeyService } from '../weather-stations/weather-stations-api-key.service';
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

interface SmnStationsEndpointConfig {
  tilesetIds: readonly string[];
  maxPastHoursOptions: readonly number[];
}

// Shape of `/weather-stations/{latest,tilesetId}` from the data-service.
interface BackendStationObservation {
  station_id: number;
  observed_at: string | null;
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  pressure: number | null;
  visibility: number | null;
  weather: { id: number; description: string } | null;
  wind: SmnCurrentWeatherStationDto['wind'] | null;
}

interface BackendSnapshot {
  scraped_at: string;
  source_url: string;
  stations: BackendStationObservation[];
}

interface BackendTilesetEntry {
  tileset_id: string;
  scraped_at: string;
  station_count: number;
}

interface BackendTilesetsResponse {
  tilesets: BackendTilesetEntry[];
}

interface BackendRegistryEntry {
  station_id: number;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  altitude_meters: number;
  oaci_code: string | null;
}

interface BackendRegistryResponse {
  fetched_at: string;
  source_url: string;
  stations: BackendRegistryEntry[];
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
  private readonly apiKeyService = inject(WeatherStationsApiKeyService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 10_000;
  private readonly refreshTimers = new Map<string, number>();
  private readonly smnStationsSnapshotSignal = signal<SmnStationSnapshot | null>(null);
  private readonly smnStationsEndpointConfigSignal = signal<SmnStationsEndpointConfig | null>(null);
  private readonly smnStationsLoadTickSignal = signal(0);
  private readonly smnStationsRegistrySignal = signal<readonly SmnStationDto[] | null>(null);
  private smnStationsInflight: Promise<SmnStationSnapshot> | null = null;
  private smnStationsRegistryInflight: Promise<readonly SmnStationDto[]> | null = null;

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
    const config = await this.fetchSmnStationsEndpointConfig();
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
    const temporalMode = this.layerControlService.getSmnStationsTemporalMode();
    const source: SmnStationSnapshot['source'] =
      temporalMode === SmnStationsTemporalMode.SPECIFIC ? 'tileset' : 'latest';

    // Two attempts at most: the second only fires if the first failed with
    // 401 and the user provided a new API key via the re-prompt dialog.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.runSmnStationsFetchAttempt(temporalMode, source);
      } catch (error) {
        if (this.isHttp401(error) && attempt === 1) {
          const newKey = await this.apiKeyService.handleUnauthorized();
          if (newKey) {
            // Drop any cached registry so the retry re-fetches it with the
            // new key (the previous load may have 401'd before populating).
            this.smnStationsRegistrySignal.set(null);
            continue;
          }
          console.warn(
            '[LayerRefreshService] SMN stations 401 and no new key provided',
          );
        } else {
          console.warn(
            '[LayerRefreshService] failed to load SMN stations snapshot',
            { error },
          );
        }
        break;
      }
    }

    return {
      observations: [],
      fetchedAt: new Date().toISOString(),
      source,
    };
  }

  private async runSmnStationsFetchAttempt(
    temporalMode: SmnStationsTemporalMode,
    source: SmnStationSnapshot['source'],
  ): Promise<SmnStationSnapshot> {
    // Both calls hit the same backend; run them in parallel to cut latency.
    const [endpointConfig, registry] = await Promise.all([
      this.fetchSmnStationsEndpointConfig(),
      this.ensureSmnStationsRegistryLoaded(),
    ]);
    this.smnStationsEndpointConfigSignal.set(endpointConfig);
    this.syncSmnStationsTemporalControlsWithConfig(endpointConfig);

    let backendSnapshot: BackendSnapshot;
    let referenceTimestamp: Date;
    let maxPastHours: number;

    if (temporalMode === SmnStationsTemporalMode.SPECIFIC) {
      const tilesetId = this.resolveRequestedSmnStationsTilesetId(endpointConfig.tilesetIds);
      maxPastHours = this.layerControlService.getSmnStationsMaxPastHours();
      if (!tilesetId) {
        throw new Error('No tilesets available for SMN stations specific mode');
      }
      backendSnapshot = await firstValueFrom(
        this.http.get<BackendSnapshot>(
          buildWeatherStationsTilesetUrl(tilesetId, maxPastHours),
          { headers: this.buildSmnStationsAuthHeaders() },
        ),
      );
      referenceTimestamp = this.fromSmnStationsTilesetId(tilesetId) ?? new Date();
    } else {
      backendSnapshot = await firstValueFrom(
        this.http.get<BackendSnapshot>(buildWeatherStationsLatestUrl(), {
          headers: this.buildSmnStationsAuthHeaders(),
        }),
      );
      referenceTimestamp = new Date(backendSnapshot.scraped_at);
      // hasData is always true in latest mode; window doesn't matter.
      maxPastHours = 0;
    }

    const observations = this.joinSnapshotWithRegistry(
      backendSnapshot,
      registry,
      referenceTimestamp,
      maxPastHours,
      temporalMode === SmnStationsTemporalMode.LATEST,
    );

    return {
      observations,
      fetchedAt: new Date().toISOString(),
      source,
    };
  }

  private isHttp401(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 401;
  }

  private buildSmnStationsAuthHeaders(): Record<string, string> {
    const apiKey = this.apiKeyService.getKey();
    return apiKey ? { 'X-API-Key': apiKey } : {};
  }

  private async fetchSmnStationsEndpointConfig(): Promise<SmnStationsEndpointConfig> {
    try {
      const resp = await firstValueFrom(
        this.http.get<BackendTilesetsResponse>(buildWeatherStationsTilesetsUrl(), {
          headers: this.buildSmnStationsAuthHeaders(),
        }),
      );
      return {
        tilesetIds: resp.tilesets.map((t) => t.tileset_id),
        maxPastHoursOptions: [...SMN_STATIONS_MAX_PAST_HOURS_OPTIONS],
      };
    } catch (error) {
      // 401s must propagate so the outer fetcher can re-prompt for an API
      // key. Other errors (network, 5xx) keep the existing fail-soft
      // behavior of returning an empty config.
      if (this.isHttp401(error)) {
        throw error;
      }
      console.warn('[LayerRefreshService] failed to load SMN tilesets', { error });
      return { tilesetIds: [], maxPastHoursOptions: [...SMN_STATIONS_MAX_PAST_HOURS_OPTIONS] };
    }
  }

  private async ensureSmnStationsRegistryLoaded(): Promise<readonly SmnStationDto[]> {
    const cached = this.smnStationsRegistrySignal();
    if (cached) {
      return cached;
    }
    if (this.smnStationsRegistryInflight) {
      return this.smnStationsRegistryInflight;
    }
    this.smnStationsRegistryInflight = this.fetchSmnStationsRegistry();
    try {
      const registry = await this.smnStationsRegistryInflight;
      this.smnStationsRegistrySignal.set(registry);
      return registry;
    } finally {
      this.smnStationsRegistryInflight = null;
    }
  }

  private async fetchSmnStationsRegistry(): Promise<readonly SmnStationDto[]> {
    const resp = await firstValueFrom(
      this.http.get<BackendRegistryResponse>(buildWeatherStationsRegistryUrl(), {
        headers: this.buildSmnStationsAuthHeaders(),
      }),
    );
    return resp.stations.map((s) => this.adaptBackendStationToDto(s));
  }

  private adaptBackendStationToDto(s: BackendRegistryEntry): SmnStationDto {
    return {
      id: s.station_id,
      name: s.name,
      province: s.province,
      coord: { lat: s.latitude, lon: s.longitude },
      height: s.altitude_meters,
      airport_code: s.oaci_code ?? '',
      type: 'AUTOMATICA',
      ref: { location_id: s.station_id },
    };
  }

  private joinSnapshotWithRegistry(
    snapshot: BackendSnapshot,
    registry: readonly SmnStationDto[],
    referenceTimestamp: Date,
    maxPastHours: number,
    isLatestMode: boolean,
  ): SmnStationObservation[] {
    const observationsById = new Map<number, BackendStationObservation>();
    for (const o of snapshot.stations) {
      observationsById.set(o.station_id, o);
    }
    const windowStart = new Date(
      referenceTimestamp.getTime() - maxPastHours * 60 * 60 * 1000,
    );

    const result: SmnStationObservation[] = [];
    for (const station of registry) {
      const obs = observationsById.get(station.id);
      if (!obs) {
        continue;
      }
      const weather = this.adaptBackendObservationToDto(obs);
      const hasData =
        isLatestMode ||
        (weather.date ? new Date(weather.date).getTime() >= windowStart.getTime() : false);
      result.push({ station, weather, hasData });
    }
    return result.sort((a, b) => a.station.name.localeCompare(b.station.name, 'es'));
  }

  private adaptBackendObservationToDto(o: BackendStationObservation): SmnCurrentWeatherStationDto {
    return {
      date: o.observed_at ?? '',
      station_id: o.station_id,
      temperature: o.temperature ?? 0,
      feels_like: o.feels_like ?? 0,
      humidity: o.humidity ?? 0,
      pressure: o.pressure ?? 0,
      visibility: o.visibility ?? 0,
      weather: o.weather ?? { id: 0, description: '' },
      wind: o.wind ?? { direction: 'Calma', deg: 0, speed: null },
    };
  }

  private syncSmnStationsTemporalControlsWithConfig(config: SmnStationsEndpointConfig): void {
    if (config.tilesetIds.length === 0) {
      this.layerControlService.setSmnStationsSelectedTilesetId(null);
      return;
    }
    const selectedTilesetId = this.resolveRequestedSmnStationsTilesetId(config.tilesetIds);
    this.layerControlService.setSmnStationsSelectedTilesetId(selectedTilesetId);
  }

  private resolveRequestedSmnStationsTilesetId(tilesetIds: readonly string[]): string {
    const selectedTilesetId = this.layerControlService.getSmnStationsSelectedTilesetId();
    if (selectedTilesetId && tilesetIds.includes(selectedTilesetId)) {
      return selectedTilesetId;
    }
    return tilesetIds[tilesetIds.length - 1] ?? '';
  }

  private fromSmnStationsTilesetId(tilesetId: string): Date | null {
    // Backend emits `YYYYMMDDTHH00Z` (always hour-bucketed; minutes are 00).
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
