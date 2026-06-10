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
  WrfTileLayer,
  WrfTileLayerConfig,
} from '../../models';
import { LayersService } from './layers.service';
import {
  parseGoesTimestamp,
  parseRadarTimestamp,
  parseEcmwfTimestamp,
  parseWrfStepTimestamp,
} from '../../utils/tileset-timestamp';
import { computeWindowStart } from '../../utils/playback-window';

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

            // Preserve the existing availableTilesets verbatim when a config
            // already exists — it's a selection-derived view maintained by
            // updateEcmwfTpSelectedForecasts and the reconciliation effect in
            // LayerControlService. Re-seeding it from forecasts[0] on every
            // 10s auto-refresh would clobber the user's selection-aware union
            // and cause downstream tile churn. The trim is per-forecast (cap
            // of maxLoopPeriods) and is already applied to each forecast's
            // periods above; re-trimming the union here would drop periods
            // contributed exclusively by older forecast runs whenever the
            // union exceeds the per-forecast cap, triggering a ping-pong with
            // the reconciliation effect that re-derives the un-trimmed union.
            // On the initial fetch (no prior config), seed from forecasts[0]'s
            // periods as a sensible default until the selection-aware
            // reconciliation runs.
            const existing = this.configMap().get(layer.id) as EcmwfTpTileLayerConfig | undefined;
            const availableTilesets: TilesetEntry[] = existing
              ? [...existing.availableTilesets]
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
   * Exposes the full sorted union of periods across the selection.
   *
   * Each forecast's periods are already trimmed to maxLoopPeriods at fetch
   * time; the union must not be re-trimmed here, otherwise the earliest
   * periods contributed exclusively by older forecast runs would be dropped.
   */
  updateEcmwfTpSelectedForecasts(
    layerId: string,
    selectedForecastTimestamps: string[],
  ): EcmwfTpTileLayerConfig | undefined {
    const config = this.getConfig(layerId) as EcmwfTpTileLayerConfig | undefined;
    if (!config || config.category !== LayerCategory.ECMWF_TP) return undefined;

    const periodSet = new Set<string>();
    const selectedPeriodsByForecast: Record<string, string[]> = {};
    for (const forecastTs of selectedForecastTimestamps) {
      const periods = config.periodsByForecast[forecastTs] ?? [];
      selectedPeriodsByForecast[forecastTs] = periods;
      for (const p of periods) {
        periodSet.add(p);
      }
    }

    const sortedPeriods = [...periodSet].sort();
    const availableTilesets: TilesetEntry[] = sortedPeriods.map((id) => ({
      id,
      time: parseEcmwfTimestamp(id) ?? new Date(0),
    }));

    // Returned synchronously so the caller can read the new union size
    // immediately — the underlying signal write in updateConfigMap is deferred
    // via queueMicrotask, so getConfig() right after the call would still
    // return the previous availableTilesets.
    const newConfig: EcmwfTpTileLayerConfig = {
      ...config,
      availableTilesets,
      forecastsByPeriod: this.buildForecastsByPeriod(selectedPeriodsByForecast),
    };
    this.updateConfigMap(layerId, newConfig);
    return newConfig;
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
      case LayerCategory.WRF:
        return this.fetchWrfLayerConfig(layer as WrfTileLayer);
      default:
        throw new Error(`Layer category ${layer.category} does not require tileset configuration`);
    }
  }

  /**
   * Fetches and updates the configuration for a WRF model product.
   * Lists init runs (corridas) and the steps (fxxx) of each, plus the
   * GeoJSON layers per step. Mirrors `fetchEcmwfTpLayerConfig`.
   */
  fetchWrfLayerConfig(layer: WrfTileLayer): Observable<WrfTileLayerConfig> {
    const initRunsUrl = buildConfigUrl(layer.id);
    return this.http
      .get<{ init_runs: Array<{ init_tag: string; step_count: number }> }>(initRunsUrl)
      .pipe(
        switchMap((resp) => {
          const initRuns = (resp.init_runs ?? []).map((r) => r.init_tag);
          if (!initRuns.length) {
            // Backend OK pero sin datos aún (sync no terminó / no hay tiles).
            // Devolver config vacía para no bloquear la UI; el layer-refresh
            // re-fetcheará periódicamente hasta que aparezcan corridas.
            const emptyConfig: WrfTileLayerConfig = {
              layerId: layer.id,
              type: LayerType.TILE,
              category: LayerCategory.WRF,
              availableTilesets: [],
              availableForecasts: [],
              periodsByForecast: {},
              forecastsByPeriod: {},
              layersByStep: {},
            };
            this.updateConfigMap(layer.id, emptyConfig);
            return of(emptyConfig);
          }

          const stepRequests = initRuns.map((initTag) =>
            this.http
              .get<{ steps: Array<{ fxxx: string; layers?: string[] }> }>(
                buildConfigUrl(`${layer.id}/${initTag}`),
              )
              .pipe(
                map((r) => {
                  const steps = (r.steps ?? []).map((s) => s.fxxx).sort();
                  const layersByStep: Record<string, readonly string[]> = {};
                  for (const step of r.steps ?? []) {
                    layersByStep[`${initTag}/${step.fxxx}`] = (step.layers ?? []).slice();
                  }
                  return { initTag, steps, layersByStep };
                }),
              ),
          );

          return forkJoin(stepRequests).pipe(
            map((results) => {
              const periodsByForecast: Record<string, string[]> = {};
              const layersByStep: Record<string, readonly string[]> = {};
              results.forEach((r) => {
                periodsByForecast[r.initTag] = r.steps;
                Object.assign(layersByStep, r.layersByStep);
              });

              // forecastsByPeriod (reverse lookup epoch→corridas) se reconstruye
              // sobre TODAS las corridas para que pasos recién publicados sean
              // descubribles.
              const { forecastsByPeriod } = this.buildWrfTimeline(periodsByForecast, initRuns);

              // availableTilesets es una vista derivada de la selección
              // (updateWrfSelectedForecasts). Si ya existe config, preservarla
              // verbatim: re-sembrarla desde initRuns[0] en cada auto-refresh
              // (cada 10s) pisaría la unión seleccionada por el usuario. A
              // diferencia de ECMWF, WRF no tiene efecto de reconciliación que
              // la restaure. En el primer fetch (sin config previa) se siembra
              // con la corrida más reciente como default sensato.
              const existing = this.configMap().get(layer.id) as WrfTileLayerConfig | undefined;
              const availableTilesets: TilesetEntry[] = existing
                ? [...existing.availableTilesets]
                : this.buildWrfTimeline(periodsByForecast, [initRuns[0]]).availableTilesets;

              const config: WrfTileLayerConfig = {
                layerId: layer.id,
                type: LayerType.TILE,
                category: LayerCategory.WRF,
                availableTilesets,
                availableForecasts: initRuns,
                periodsByForecast,
                forecastsByPeriod,
                layersByStep,
              };
              this.updateConfigMap(layer.id, config);
              return config;
            }),
          );
        }),
        catchError((error) => {
          console.error(`Failed to fetch WRF config for ${layer.id}:`, error);
          throw error;
        }),
      );
  }

  /**
   * Recalcula `availableTilesets` para una capa WRF en base a los init_tags
   * seleccionados. Espejo de `updateEcmwfTpSelectedForecasts`.
   */
  updateWrfSelectedForecasts(
    layerId: string,
    selectedInitTags: string[],
  ): WrfTileLayerConfig | undefined {
    const config = this.getConfig(layerId) as WrfTileLayerConfig | undefined;
    if (!config || config.category !== LayerCategory.WRF) return undefined;

    // Unión por instante absoluto: corridas que coinciden en una misma hora
    // comparten frame (overlap real); las que no, aportan frames propios.
    const { availableTilesets, forecastsByPeriod } = this.buildWrfTimeline(
      config.periodsByForecast,
      selectedInitTags,
    );

    // Se devuelve sincrónicamente para que el caller lea la nueva unión de
    // inmediato — el write del signal en updateConfigMap es diferido vía
    // queueMicrotask, así que getConfig() justo después vería la anterior.
    const newConfig: WrfTileLayerConfig = {
      ...config,
      availableTilesets,
      forecastsByPeriod,
    };
    this.updateConfigMap(layerId, newConfig);
    return newConfig;
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
   * Construye el timeline WRF keyado por instante ABSOLUTO (no por fxxx),
   * de forma análoga a ECMWF. Une los pasos de todas las corridas indicadas:
   * pasos de distintas corridas que caen en la misma hora absoluta comparten
   * frame; el id de cada tileset es el epoch (`String(time.getTime())`).
   *
   * Devuelve también el reverse lookup `forecastsByPeriod[absId] = init_tags`
   * que tienen un paso en ese instante. El fxxx concreto por corrida se
   * deriva en tiempo de render con `wrfFxxxForInitAndTime(initTag, time)`.
   */
  private buildWrfTimeline(
    periodsByForecast: Readonly<Record<string, string[]>>,
    initTags: readonly string[],
  ): { availableTilesets: TilesetEntry[]; forecastsByPeriod: Record<string, string[]> } {
    const byTime = new Map<string, { time: Date; inits: string[] }>();
    for (const initTag of initTags) {
      for (const fxxx of periodsByForecast[initTag] ?? []) {
        const time = parseWrfStepTimestamp(initTag, fxxx);
        if (!time) continue;
        const id = String(time.getTime());
        const entry = byTime.get(id) ?? { time, inits: [] };
        entry.inits.push(initTag);
        byTime.set(id, entry);
      }
    }

    const sorted = [...byTime.entries()].sort((a, b) => a[1].time.getTime() - b[1].time.getTime());
    const availableTilesets: TilesetEntry[] = sorted.map(([id, e]) => ({ id, time: e.time }));
    const forecastsByPeriod: Record<string, string[]> = {};
    for (const [id, e] of sorted) forecastsByPeriod[id] = e.inits;
    return { availableTilesets, forecastsByPeriod };
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

        return computeWindowStart(totalTilesets, imageCount, isForecast);
      }
      default:
        throw new Error(
          `Cannot calculate time index for non-TILE layer '${layerId}' (type: ${config.type})`,
        );
    }
  }
}
