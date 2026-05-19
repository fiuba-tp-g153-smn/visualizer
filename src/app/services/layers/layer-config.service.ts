import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError, switchMap } from 'rxjs';
import { buildConfigUrl } from '../../config';
import {
  Layer,
  LayerConfig,
  LayerCategory,
  RadarTileLayerConfig,
  GoesTileLayer,
  LayerType,
  RadarTileLayer,
  GoesTileLayerConfig,
  TileLayerConfig,
  TilesetEntry,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
} from '../../models';
import { LayersService } from './layers.service';
import {
  parseGoesTimestamp,
  parseRadarTimestamp,
  parseEcmwfTimestamp,
} from '../../utils/tileset-timestamp';
import { computeWindowStart, getDefaultCursorIndex } from '../../utils/playback-window';

/**
 * Service responsible for fetching and caching layer configurations.
 *
 * This service handles:
 * - Fetching layer configurations from the backend API
 * - Maintaining a reactive signal-based cache of configurations
 * - Providing type-safe accessors for different layer types
 * - Managing HTTP requests for GOES and Radar layers with different structures
 *
 * GOES layers have a single list of available tilesets, while Radar layers
 * organize tilesets by elevation angle (0.5°, 1.0°, etc.).
 */
@Injectable({
  providedIn: 'root',
})
export class LayerConfigService {
  private readonly http = inject(HttpClient);
  private readonly layersService = inject(LayersService);
  private readonly configMap = signal<Map<string, LayerConfig>>(new Map());

  // ============================================================================
  // Public Signals
  // ============================================================================

  /**
   * Read-only signal containing all layer configurations.
   * Other services can subscribe to this for reactive updates.
   */
  readonly configs = this.configMap.asReadonly();

  // ============================================================================
  // Public Methods - Fetching
  // ============================================================================

  /**
   * Fetches and updates the configuration for a GOES satellite layer.
   * Makes a single HTTP request to get available tilesets.
   */
  fetchGoesLayerConfig(layer: GoesTileLayer): Observable<GoesTileLayerConfig> {
    const configUrl = buildConfigUrl(layer.id);
    return this.http.get<any>(configUrl).pipe(
      map((response) => {
        const parsedTilesets: TilesetEntry[] = (response.tilesets as any[])
          .map((t: any) => t.id as string)
          .sort()
          .map((id: string) => ({ id, time: parseGoesTimestamp(id) }))
          .filter((e): e is TilesetEntry => e.time !== null);
        const availableTilesets = this.keepLatestTilesetsForLayer(
          layer.availablePeriods,
          parsedTilesets,
        );

        const layerConfig: GoesTileLayerConfig = {
          layerId: layer.id,
          type: LayerType.TILE,
          category: LayerCategory.GOES_19,
          availableTilesets,
        };

        this.updateConfigMap(layer.id, layerConfig);
        return layerConfig;
      }),
      catchError((error) => {
        console.error(`Failed to fetch config for layer ${layer.id}:`, error);
        throw error;
      }),
    );
  }

  /**
   * Fetches and updates the configuration for a radar layer.
   * Makes a single HTTP request (tilesets are now shared across elevations).
   * Returns an empty configuration if no elevations are available.
   */
  fetchRadarLayerConfig(layer: RadarTileLayer): Observable<RadarTileLayerConfig> {
    if (!layer.availableElevations || layer.availableElevations.length === 0) {
      const emptyConfig: RadarTileLayerConfig = {
        layerId: layer.id,
        type: LayerType.TILE,
        category: LayerCategory.RADAR,
        availableTilesets: [],
      };
      return of(emptyConfig);
    }

    // Fetch from first elevation (tilesets are shared across all elevations now)
    const firstElevation = layer.availableElevations[0];
    const pathToProduct = `${layer.id}/${firstElevation.id}`;
    const configUrl = buildConfigUrl(pathToProduct);

    return this.http.get<any>(configUrl).pipe(
      map((response) => {
        const parsedTilesets: TilesetEntry[] = ((response.tilesets || []) as string[])
          .sort()
          .map((id) => ({ id, time: parseRadarTimestamp(id) }))
          .filter((e): e is TilesetEntry => e.time !== null);
        const availableTilesets = this.keepLatestTilesetsForLayer(
          layer.availablePeriods,
          parsedTilesets,
        );

        const config: RadarTileLayerConfig = {
          layerId: layer.id,
          type: LayerType.TILE,
          category: LayerCategory.RADAR,
          availableTilesets,
        };
        this.updateConfigMap(layer.id, config);
        return config;
      }),
      catchError((error) => {
        console.error(`Failed to fetch radar config for ${pathToProduct}:`, error);
        throw error;
      }),
    );
  }

  /**
   * Fetches and updates the configuration for an ECMWF layer.
   * Fetches all available forecast runs and all their periods in parallel via forkJoin.
   */
  fetchEcmwfTpLayerConfig(layer: EcmwfTpTileLayer): Observable<EcmwfTpTileLayerConfig> {
    const forecastsUrl = buildConfigUrl(layer.id);
    return this.http.get<{ forecasts: Array<{ forecast_ts: string }> }>(forecastsUrl).pipe(
      switchMap((resp) => {
        if (!resp.forecasts?.length) {
          throw new Error(`No forecasts available for ${layer.id}`);
        }
        const forecasts = resp.forecasts.map((f) => f.forecast_ts);

        const periodRequests = forecasts.map((ts) =>
          this.http
            .get<{ periods: Array<{ period_ts: string }> }>(buildConfigUrl(`${layer.id}/${ts}`))
            .pipe(
              map((r) => {
                const sortedPeriodIds = r.periods.map((p) => p.period_ts).sort();
                return {
                  ts,
                  periods: this.keepLatestPeriodIdsForLayer(
                    layer.availablePeriods,
                    sortedPeriodIds,
                  ),
                };
              }),
            ),
        );

        return forkJoin(periodRequests).pipe(
          map((results) => {
            const periodsByForecast: Record<string, string[]> = {};
            results.forEach((r) => {
              periodsByForecast[r.ts] = r.periods;
            });

            const forecastsByPeriod = this.buildForecastsByPeriod(periodsByForecast);

            // Preserve the existing availableTilesets when a config already
            // exists — it's a selection-derived view maintained by
            // updateEcmwfTpSelectedForecasts and the reconciliation effect in
            // LayerControlService. Re-seeding it from forecasts[0] on every
            // 10s auto-refresh would clobber the user's selection-aware union
            // and cause downstream tile churn. On the initial fetch (no prior
            // config), seed from forecasts[0]'s periods as a sensible default
            // until the selection-aware reconciliation runs.
            const existing = this.configMap().get(layer.id) as EcmwfTpTileLayerConfig | undefined;
            const availableTilesets: TilesetEntry[] = existing
              ? this.keepLatestTilesetsForLayer(layer.availablePeriods, existing.availableTilesets)
              : this.keepLatestTilesetsForLayer(
                  layer.availablePeriods,
                  (periodsByForecast[forecasts[0]] ?? []).map((id) => ({
                    id,
                    time: parseEcmwfTimestamp(id) ?? new Date(0),
                  })),
                );

            const config: EcmwfTpTileLayerConfig = {
              layerId: layer.id,
              type: LayerType.TILE,
              category: LayerCategory.ECMWF_TP,
              availableTilesets,
              availableForecasts: forecasts,
              periodsByForecast,
              forecastsByPeriod,
            };
            this.updateConfigMap(layer.id, config);
            return config;
          }),
        );
      }),
      catchError((error) => {
        console.error(`Failed to fetch ECMWF config for ${layer.id}:`, error);
        throw error;
      }),
    );
  }

  /**
   * Updates the availableTilesets for an ECMWF layer based on the selected forecasts.
   * Uses the first selected forecast's periods for the time slider.
   */
  updateEcmwfTpSelectedForecasts(layerId: string, selectedForecastTimestamps: string[]): void {
    const config = this.getConfig(layerId) as EcmwfTpTileLayerConfig | undefined;
    if (!config || config.category !== LayerCategory.ECMWF_TP) return;

    // Compute sorted union of all periods across selected forecasts
    const periodSet = new Set<string>();
    for (const forecastTs of selectedForecastTimestamps) {
      const periods = config.periodsByForecast[forecastTs];
      if (periods) {
        for (const p of periods) {
          periodSet.add(p);
        }
      }
    }

    // Build reverse lookup scoped to selected forecasts
    const selectedPeriodsByForecast: Record<string, string[]> = {};
    for (const forecastTs of selectedForecastTimestamps) {
      selectedPeriodsByForecast[forecastTs] = config.periodsByForecast[forecastTs] ?? [];
    }

    const maxLoopPeriods = this.getMaxLoopPeriodsForLayer(layerId);
    const sortedPeriods = this.keepLatestPeriodIds(maxLoopPeriods, [...periodSet].sort());
    const availablePeriodIds = new Set(sortedPeriods);
    const prunedSelectedPeriodsByForecast: Record<string, string[]> = {};
    for (const [forecastTs, periods] of Object.entries(selectedPeriodsByForecast)) {
      prunedSelectedPeriodsByForecast[forecastTs] = periods.filter((id) =>
        availablePeriodIds.has(id),
      );
    }

    const availableTilesets: TilesetEntry[] = sortedPeriods.map((id) => ({
      id,
      time: parseEcmwfTimestamp(id) ?? new Date(0),
    }));

    this.updateConfigMap(layerId, {
      ...config,
      availableTilesets,
      forecastsByPeriod: this.buildForecastsByPeriod(prunedSelectedPeriodsByForecast),
    });
  }

  /**
   * Main entry point to fetch layer configuration.
   * Dispatches to the appropriate method based on layer category.
   *
   * @throws Error if the layer category doesn't require tileset configuration
   */
  fetchLayerConfig(layer: Layer): Observable<LayerConfig> {
    switch (layer.category) {
      case LayerCategory.GOES_19:
        return this.fetchGoesLayerConfig(layer as GoesTileLayer);
      case LayerCategory.RADAR:
        return this.fetchRadarLayerConfig(layer as RadarTileLayer);
      case LayerCategory.ECMWF_TP:
        return this.fetchEcmwfTpLayerConfig(layer as EcmwfTpTileLayer);
      default:
        throw new Error(`Layer category ${layer.category} does not require tileset configuration`);
    }
  }

  // ============================================================================
  // Public Methods - Getters
  // ============================================================================

  /**
   * Gets the configuration for a specific layer from the cache.
   * Returns undefined if the configuration hasn't been fetched yet.
   */
  getConfig(layerId: string): LayerConfig | undefined {
    return this.configMap().get(layerId);
  }

  /**
   * Checks if a configuration exists for the given layer in the cache.
   */
  hasConfig(layerId: string): boolean {
    return this.configMap().has(layerId);
  }

  /**
   * Gets available tilesets for tile layers.
   * Returns undefined if config not yet loaded.
   * @throws Error if called on non-TILE layer
   */
  getAvailableTilesets(layerId: string): TilesetEntry[] | undefined {
    const config = this.getConfig(layerId);
    if (!config) return undefined;

    switch (config.type) {
      case LayerType.TILE:
        return config.availableTilesets;
      default:
        throw new Error(
          `Cannot get available tilesets for non-TILE layer '${layerId}' (type: ${config.type})`,
        );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Updates the configuration map with a new configuration.
   * Only updates if the configuration has actually changed to avoid unnecessary reactive updates.
   */
  private updateConfigMap(layerId: string, config: LayerConfig): void {
    const existingConfig = this.configMap().get(layerId);

    // Compare configs to see if they're actually different
    if (existingConfig && this.configsAreEqual(existingConfig, config)) return;

    // Defer to avoid NG0100 (ExpressionChangedAfterItHasBeenCheckedError) when called
    // from an async context (setInterval, HTTP response) during an active CD cycle.
    queueMicrotask(() => {
      this.configMap.update((map) => {
        const newMap = new Map(map);
        newMap.set(layerId, config);
        return newMap;
      });
    });
  }

  /**
   * Compares two layer configurations to determine if they're equal.
   *
   * For ECMWF, we must also compare the backend-sourced fields
   * (availableForecasts, periodsByForecast). availableTilesets alone is a
   * selection-derived view and stays untouched on auto-refresh, so it cannot
   * detect backend changes like a newly published forecast run or a new period
   * added to an existing run.
   */
  private configsAreEqual(a: LayerConfig, b: LayerConfig): boolean {
    if (a.type !== b.type) return false;

    switch (a.type) {
      case LayerType.TILE:
        if (!this.arraysAreEqual(a.availableTilesets, (b as TileLayerConfig).availableTilesets)) {
          return false;
        }
        if (a.category === LayerCategory.ECMWF_TP) {
          const ae = a as EcmwfTpTileLayerConfig;
          const be = b as EcmwfTpTileLayerConfig;
          return (
            this.stringArraysAreEqual(ae.availableForecasts, be.availableForecasts) &&
            this.periodsByForecastAreEqual(ae.periodsByForecast, be.periodsByForecast)
          );
        }
        return true;
      default:
        return false;
    }
  }

  private stringArraysAreEqual(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private periodsByForecastAreEqual(
    a: Readonly<Record<string, string[]>>,
    b: Readonly<Record<string, string[]>>,
  ): boolean {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    for (const key of aKeys) {
      const bArr = b[key];
      if (bArr === undefined) return false;
      if (!this.stringArraysAreEqual(a[key], bArr)) return false;
    }
    return true;
  }

  /**
   * Builds a reverse lookup: period → forecast timestamps that contain it.
   */
  private buildForecastsByPeriod(
    periodsByForecast: Readonly<Record<string, string[]>>,
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [forecastTs, periods] of Object.entries(periodsByForecast)) {
      for (const period of periods) {
        if (!result[period]) {
          result[period] = [];
        }
        result[period].push(forecastTs);
      }
    }
    return result;
  }

  /**
   * Compares two arrays for equality.
   */
  private arraysAreEqual(a: readonly TilesetEntry[], b: readonly TilesetEntry[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
    }
    return true;
  }

  private keepLatestPeriodIdsForLayer(
    availablePeriods: readonly number[] | undefined,
    periodIds: readonly string[],
  ): string[] {
    return this.keepLatestPeriodIds(this.getMaxLoopPeriods(availablePeriods), periodIds);
  }

  private keepLatestTilesetsForLayer(
    availablePeriods: readonly number[] | undefined,
    tilesets: readonly TilesetEntry[],
  ): TilesetEntry[] {
    return this.keepLatestTilesets(this.getMaxLoopPeriods(availablePeriods), tilesets);
  }

  private getMaxLoopPeriodsForLayer(layerId: string): number | undefined {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE) {
      return undefined;
    }

    return this.getMaxLoopPeriods(layer.availablePeriods);
  }

  private getMaxLoopPeriods(availablePeriods: readonly number[] | undefined): number | undefined {
    if (!availablePeriods || availablePeriods.length === 0) {
      return undefined;
    }

    const max = Math.max(...availablePeriods);
    return Number.isFinite(max) && max > 0 ? Math.floor(max) : undefined;
  }

  private keepLatestPeriodIds(
    maxPeriods: number | undefined,
    periodIds: readonly string[],
  ): string[] {
    if (!maxPeriods || periodIds.length <= maxPeriods) {
      return [...periodIds];
    }

    return periodIds.slice(-maxPeriods);
  }

  private keepLatestTilesets(
    maxPeriods: number | undefined,
    tilesets: readonly TilesetEntry[],
  ): TilesetEntry[] {
    if (!maxPeriods || tilesets.length <= maxPeriods) {
      return [...tilesets];
    }

    return tilesets.slice(-maxPeriods);
  }

  // ============================================================================
  // Public Methods - TimeIndex Calculation
  // ============================================================================

  /**
   * Calculates the optimal timeIndex for a given range of images.
   * @param layerId - The layer ID
   * @param imageCount - Number of most recent images to include
   * @returns The calculated timeIndex, or undefined if config not available
   * @throws Error if called on non-TILE layer or no tilesets available
   */
  calculateTimeIndexForRange(layerId: string, imageCount: number): number | undefined {
    const config = this.getConfig(layerId);
    if (!config) return undefined;

    switch (config.type) {
      case LayerType.TILE: {
        const totalTilesets = config.availableTilesets.length;

        if (totalTilesets === 0) {
          throw new Error(`No tilesets available for layer '${layerId}'`);
        }

        const layer = this.layersService.getLayerById(layerId);
        const isForecast = layer?.type === LayerType.TILE && layer.isForecast;

        if (imageCount === 1) {
          // Single-frame mode: jump to the layer's default cursor
          // (first frame for forecasts, last for historical).
          return getDefaultCursorIndex(totalTilesets, isForecast);
        }

        // Multi-frame mode: position cursor at the start of the active window.
        return computeWindowStart(totalTilesets, imageCount, isForecast);
      }
      default:
        throw new Error(
          `Cannot calculate time index for non-TILE layer '${layerId}' (type: ${config.type})`,
        );
    }
  }
}
