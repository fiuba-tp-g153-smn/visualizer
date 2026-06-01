import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { Observable, throwError, firstValueFrom, from } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import {
  buildWeatherStationsLatestUrl,
  buildWeatherStationsRegistryUrl,
  buildWeatherStationsTilesetUrl,
  buildWeatherStationsTilesetsUrl,
} from '../../config/backend.config';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { LayerControlService } from './layer-control.service';
import { WeatherStationsPrefetchService } from './weather-stations-prefetch.service';
import { NotificationService } from '../notifications/notification.service';
import {
  WEATHER_STATIONS_IMAGE_COUNT_OPTIONS,
  WeatherStationsTemporalMode,
} from '../../config/layers/weather-stations/controls.constants';
import {
  LayerConfig,
  LayerType,
  LayerCategory,
  TileLayerConfig,
  NotificationType,
  TilesetEntry,
  CurrentWeatherStationDto,
  WeatherStationDto,
  WeatherStationObservation,
  WeatherStationSnapshot,
} from '../../models';

interface WeatherStationsEndpointConfig {
  tilesetIds: readonly string[];
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
  wind: CurrentWeatherStationDto['wind'] | null;
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
  private readonly weatherStationsPrefetch = inject(WeatherStationsPrefetchService);

  private readonly AUTO_REFRESH_INTERVAL_MS = 10_000;
  private readonly refreshTimers = new Map<string, number>();
  private readonly loadingLayerIdsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly weatherStationsSnapshotSignal = signal<WeatherStationSnapshot | null>(null);
  private readonly weatherStationsEndpointConfigSignal =
    signal<WeatherStationsEndpointConfig | null>(null);
  private readonly weatherStationsLoadTickSignal = signal(0);
  private readonly weatherStationsRegistrySignal = signal<readonly WeatherStationDto[] | null>(null);
  private weatherStationsInflight: Promise<WeatherStationSnapshot> | null = null;
  private weatherStationsRegistryInflight: Promise<readonly WeatherStationDto[]> | null = null;
  // `/tilesets` changes ~hourly (a new bucket appears); cache it for a short TTL
  // so animation frames don't each re-fetch it. Aligns with its Cache-Control.
  private readonly WEATHER_STATIONS_TILESETS_TTL_MS = 60_000;
  private weatherStationsEndpointConfigFetchedAt = 0;
  private weatherStationsEndpointConfigInflight: Promise<WeatherStationsEndpointConfig> | null = null;

  readonly weatherStationsLoadTick = this.weatherStationsLoadTickSignal.asReadonly();
  readonly loadingLayerIds = this.loadingLayerIdsSignal.asReadonly();

  isLoadingConfig(layerId: string): Signal<boolean> {
    return computed(() => this.loadingLayerIdsSignal().has(layerId));
  }

  private markLoading(layerId: string): void {
    const current = this.loadingLayerIdsSignal();
    if (current.has(layerId)) return;
    const next = new Set(current);
    next.add(layerId);
    this.loadingLayerIdsSignal.set(next);
  }

  private clearLoading(layerId: string): void {
    const current = this.loadingLayerIdsSignal();
    if (!current.has(layerId)) return;
    const next = new Set(current);
    next.delete(layerId);
    this.loadingLayerIdsSignal.set(next);
  }

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
            layer.category === LayerCategory.ECMWF_TP ||
            layer.category === LayerCategory.WRF);

        if (!needsConfig) {
          continue; // Skip layers that don't need config (e.g., WMS layers)
        }

        // If layer doesn't have config yet, fetch it first
        if (!this.layerConfigService.hasConfig(layer.id)) {
          this.markLoading(layer.id);
          this.layerConfigService
            .fetchLayerConfig(layer)
            .pipe(finalize(() => this.clearLoading(layer.id)))
            .subscribe({
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

      for (const layerId of this.loadingLayerIdsSignal()) {
        if (!activeLayerIds.has(layerId)) {
          this.clearLoading(layerId);
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

    // Weather stations don't use the tile-config flow (`fetchLayerConfig` rejects
    // the category). Refresh their available periods (`/weather-stations/tilesets`)
    // and the current snapshot instead.
    if (layer.category === LayerCategory.WEATHER_STATIONS) {
      return this.manualRefreshWeatherStations(layerId);
    }

    const beforeConfig = this.layerConfigService.getConfig(layerId);

    this.markLoading(layerId);
    return this.layerConfigService.fetchLayerConfig(layer).pipe(
      map(() => {
        const afterConfig = this.layerConfigService.getConfig(layerId);
        this.compareAndNotify(layerId, beforeConfig, afterConfig, true);
      }),
      finalize(() => this.clearLoading(layerId)),
    );
  }

  /** Manual "Actualizar periodos disponibles" for the weather-stations layer. */
  private manualRefreshWeatherStations(layerId: string): Observable<void> {
    const before = this.getWeatherStationsAvailableTilesetIds().length;
    this.markLoading(layerId);
    return from(this.forceRefreshWeatherStations()).pipe(
      map(() => {
        const after = this.getWeatherStationsAvailableTilesetIds().length;
        this.notifyWeatherStationsRefresh(layerId, before, after);
      }),
      finalize(() => this.clearLoading(layerId)),
    );
  }

  /**
   * Force a fresh `/tilesets` fetch (bypassing the in-app TTL), then reload the
   * snapshot. Snapshot bodies are served by the browser HTTP cache; their
   * freshness is bounded by their `Cache-Control: max-age` (the button's job is
   * refreshing the available periods list).
   */
  private async forceRefreshWeatherStations(): Promise<void> {
    this.weatherStationsEndpointConfigFetchedAt = 0;
    await this.loadWeatherStationsSnapshot(true);
  }

  private notifyWeatherStationsRefresh(layerId: string, before: number, after: number): void {
    const layerName = this.layersService.getLayerDisplayName(layerId);
    if (after !== before) {
      this.notificationService.show(
        NotificationType.SUCCESS,
        `${after} períodos disponibles para ${layerName}`,
      );
    } else {
      this.notificationService.show(NotificationType.INFO, `Sin cambios para ${layerName}`);
    }
  }

  peekWeatherStationsSnapshot(): WeatherStationSnapshot | null {
    return this.weatherStationsSnapshotSignal();
  }

  getWeatherStationsAvailableTilesetIds(): readonly string[] {
    return this.weatherStationsEndpointConfigSignal()?.tilesetIds ?? [];
  }

  async ensureWeatherStationsEndpointConfigLoaded(): Promise<void> {
    if (this.weatherStationsEndpointConfigSignal()) {
      return;
    }
    const config = await this.fetchWeatherStationsEndpointConfig();
    this.weatherStationsEndpointConfigSignal.set(config);
    this.syncWeatherStationsTemporalControlsWithConfig(config);
  }

  async loadWeatherStationsSnapshot(force = false): Promise<WeatherStationSnapshot> {
    const currentSnapshot = this.weatherStationsSnapshotSignal();
    if (!force && currentSnapshot) {
      return currentSnapshot;
    }

    if (this.weatherStationsInflight) {
      return this.weatherStationsInflight;
    }

    this.weatherStationsInflight = this.fetchWeatherStationsSnapshot();
    try {
      const snapshot = await this.weatherStationsInflight;
      this.weatherStationsSnapshotSignal.set(snapshot);
      this.weatherStationsLoadTickSignal.update((value) => value + 1);
      return snapshot;
    } finally {
      this.weatherStationsInflight = null;
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

  private async fetchWeatherStationsSnapshot(): Promise<WeatherStationSnapshot> {
    const temporalMode = this.layerControlService.getWeatherStationsTemporalMode();
    const source: WeatherStationSnapshot['source'] =
      temporalMode === WeatherStationsTemporalMode.SPECIFIC ? 'tileset' : 'latest';

    // 401 re-prompt + retry is owned by the weather-stations HTTP interceptor.
    // We only fail-soft here so any error (including a 401 the user cancelled)
    // surfaces as an empty snapshot instead of bubbling uncaught.
    try {
      return await this.runWeatherStationsFetchAttempt(temporalMode, source);
    } catch (error) {
      console.warn('[LayerRefreshService] failed to load weather stations snapshot', {
        error,
      });
      return {
        observations: [],
        fetchedAt: new Date().toISOString(),
        source,
      };
    }
  }

  private async runWeatherStationsFetchAttempt(
    temporalMode: WeatherStationsTemporalMode,
    source: WeatherStationSnapshot['source'],
  ): Promise<WeatherStationSnapshot> {
    // Both calls hit the same backend; run them in parallel to cut latency.
    const [endpointConfig, registry] = await Promise.all([
      this.fetchWeatherStationsEndpointConfig(),
      this.ensureWeatherStationsRegistryLoaded(),
    ]);
    // The signal is set inside fetchWeatherStationsEndpointConfig (with last-good
    // preservation), so we only sync the temporal controls here.
    this.syncWeatherStationsTemporalControlsWithConfig(endpointConfig);

    let backendSnapshot: BackendSnapshot;
    let referenceTimestamp: Date;
    let maxPastHours: number;

    if (temporalMode === WeatherStationsTemporalMode.SPECIFIC) {
      const tilesetId = this.resolveRequestedWeatherStationsTilesetId(endpointConfig.tilesetIds);
      maxPastHours = this.layerControlService.getWeatherStationsMaxPastHours();
      if (!tilesetId) {
        throw new Error('No tilesets available for weather stations specific mode');
      }
      // Plain GET: the browser HTTP cache serves a replayed/scrubbed frame (no
      // network), and only this current frame's payload is retained (the signal).
      backendSnapshot = await firstValueFrom(
        this.http.get<BackendSnapshot>(buildWeatherStationsTilesetUrl(tilesetId, maxPastHours)),
      );
      referenceTimestamp = this.fromWeatherStationsTilesetId(tilesetId) ?? new Date();
      // Warm the browser cache for the rest of the window so playback/scrub is
      // served off-heap from the browser cache rather than re-fetched.
      this.prefetchWeatherStationsWindow(endpointConfig.tilesetIds, maxPastHours);
    } else {
      backendSnapshot = await firstValueFrom(
        this.http.get<BackendSnapshot>(buildWeatherStationsLatestUrl()),
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
      temporalMode === WeatherStationsTemporalMode.LATEST,
    );

    return {
      observations,
      fetchedAt: new Date().toISOString(),
      source,
    };
  }

  /**
   * Warm the browser HTTP cache for the current animation window (latest
   * `imageCount` tilesets at the current Max-Past-Hours) so timeline playback is
   * served from the browser cache instead of the network. Non-blocking.
   */
  prefetchWeatherStationsWindow(tilesetIds?: readonly string[], maxPastHours?: number): void {
    const ids = tilesetIds ?? this.weatherStationsEndpointConfigSignal()?.tilesetIds ?? [];
    if (ids.length === 0) {
      return;
    }
    const n = maxPastHours ?? this.layerControlService.getWeatherStationsMaxPastHours();
    const imageCount = this.layerControlService.getWeatherStationsImageCount();
    const windowIds = imageCount > 0 ? ids.slice(-imageCount) : ids;
    // Skip the currently-selected frame — the read path just fetched it directly.
    const selected = this.layerControlService.getWeatherStationsSelectedTilesetId();
    this.weatherStationsPrefetch.prefetch(
      windowIds.filter((id) => id !== selected).map((id) => buildWeatherStationsTilesetUrl(id, n)),
    );
  }

  private async fetchWeatherStationsEndpointConfig(): Promise<WeatherStationsEndpointConfig> {
    const cached = this.weatherStationsEndpointConfigSignal();
    if (
      cached &&
      Date.now() - this.weatherStationsEndpointConfigFetchedAt <
        this.WEATHER_STATIONS_TILESETS_TTL_MS
    ) {
      return cached;
    }
    if (this.weatherStationsEndpointConfigInflight) {
      return this.weatherStationsEndpointConfigInflight;
    }
    this.weatherStationsEndpointConfigInflight =
      this.fetchWeatherStationsEndpointConfigFromBackend();
    try {
      const config = await this.weatherStationsEndpointConfigInflight;
      // Keep the last-good config when a refresh comes back empty/failed, rather
      // than blanking the timeline.
      if (config.tilesetIds.length > 0) {
        this.weatherStationsEndpointConfigSignal.set(config);
        this.weatherStationsEndpointConfigFetchedAt = Date.now();
        return config;
      }
      return cached ?? config;
    } finally {
      this.weatherStationsEndpointConfigInflight = null;
    }
  }

  private async fetchWeatherStationsEndpointConfigFromBackend(): Promise<WeatherStationsEndpointConfig> {
    try {
      const resp = await firstValueFrom(
        this.http.get<BackendTilesetsResponse>(buildWeatherStationsTilesetsUrl()),
      );
      const maxLoopPeriods = Math.max(...WEATHER_STATIONS_IMAGE_COUNT_OPTIONS);
      const sortedTilesetIds = resp.tilesets.map((t) => t.tileset_id).sort();
      return {
        tilesetIds:
          sortedTilesetIds.length > maxLoopPeriods
            ? sortedTilesetIds.slice(-maxLoopPeriods)
            : sortedTilesetIds,
      };
    } catch (error) {
      // The interceptor already re-prompted on 401; a 401 reaching here means
      // the user cancelled. Treat it like any other failure (fail-soft).
      console.warn('[LayerRefreshService] failed to load weather station tilesets', { error });
      return { tilesetIds: [] };
    }
  }

  private async ensureWeatherStationsRegistryLoaded(): Promise<readonly WeatherStationDto[]> {
    const cached = this.weatherStationsRegistrySignal();
    if (cached) {
      return cached;
    }
    if (this.weatherStationsRegistryInflight) {
      return this.weatherStationsRegistryInflight;
    }
    this.weatherStationsRegistryInflight = this.fetchWeatherStationsRegistry();
    try {
      const registry = await this.weatherStationsRegistryInflight;
      this.weatherStationsRegistrySignal.set(registry);
      return registry;
    } finally {
      this.weatherStationsRegistryInflight = null;
    }
  }

  private async fetchWeatherStationsRegistry(): Promise<readonly WeatherStationDto[]> {
    const resp = await firstValueFrom(
      this.http.get<BackendRegistryResponse>(buildWeatherStationsRegistryUrl()),
    );
    return resp.stations.map((s) => this.adaptBackendStationToDto(s));
  }

  private adaptBackendStationToDto(s: BackendRegistryEntry): WeatherStationDto {
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
    registry: readonly WeatherStationDto[],
    referenceTimestamp: Date,
    maxPastHours: number,
    isLatestMode: boolean,
  ): WeatherStationObservation[] {
    const observationsById = new Map<number, BackendStationObservation>();
    for (const o of snapshot.stations) {
      observationsById.set(o.station_id, o);
    }
    const windowStart = new Date(referenceTimestamp.getTime() - maxPastHours * 60 * 60 * 1000);

    const result: WeatherStationObservation[] = [];
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

  private adaptBackendObservationToDto(o: BackendStationObservation): CurrentWeatherStationDto {
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

  private syncWeatherStationsTemporalControlsWithConfig(config: WeatherStationsEndpointConfig): void {
    if (config.tilesetIds.length === 0) {
      this.layerControlService.setWeatherStationsSelectedTilesetId(null);
      return;
    }
    const selectedTilesetId = this.resolveRequestedWeatherStationsTilesetId(config.tilesetIds);
    this.layerControlService.setWeatherStationsSelectedTilesetId(selectedTilesetId);
  }

  private resolveRequestedWeatherStationsTilesetId(tilesetIds: readonly string[]): string {
    const selectedTilesetId = this.layerControlService.getWeatherStationsSelectedTilesetId();
    if (selectedTilesetId && tilesetIds.includes(selectedTilesetId)) {
      return selectedTilesetId;
    }
    return tilesetIds[tilesetIds.length - 1] ?? '';
  }

  private fromWeatherStationsTilesetId(tilesetId: string): Date | null {
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
   * Compares before and after configurations and shows appropriate notification.
   * If there are changes, adjusts the timeIndex based on imageCount.
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

    // If there were changes, adjust timeIndex based on imageCount
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
   * Adjusts the timeIndex after a config refresh based on imageCount.
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

    // Otherwise, recalculate based on imageCount
    const imageCount = controls.playback.imageCount;
    const newTimeIndex = this.layerConfigService.calculateTimeIndexForRange(layerId, imageCount);

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
