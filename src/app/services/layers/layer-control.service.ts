import { Injectable, inject, computed, signal, effect, untracked } from '@angular/core';
import {
  Layer,
  LayerType,
  LayerCategory,
  ActiveLayerGroupId,
  LayerControls,
  RadarLayerControls,
  BaseLayerControls,
  TileLayerControls,
  GoesLayerControls,
  RadarElevation,
  RadarTileLayer,
  TilesetEntry,
  ActiveLayerEntry,
  EcmwfTpLayerControls,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
  WmsLayerControls,
  VectorLayerControls,
  WrfLayerControls,
  WrfTileLayer,
  ForecastRenderControls,
  ForecastRenderControlsByForecast,
  PRIMARY_RENDER_ID,
} from '../../models';
import { LayersService } from './layers.service';
import {
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  DEFAULT_ACTIVE_LAYERS,
  DEFAULT_LAYER_CONTROLS,
} from '../../config/layers';
import { STORAGE_KEYS } from '../../constants';
import { LayerConfigService } from './layer-config.service';
import { PlaybackEngineService } from './playback-engine.service';
import { LocalStorageService } from '../storage/local-storage.service';
import {
  buildEcmwfTpFrameOptions,
  computeWindowStart,
  getDefaultCursorIndex,
} from '../../utils/playback-window';
import {
  DEFAULT_WEATHER_STATIONS_GRACE_PERIOD_HOURS,
  WEATHER_STATIONS_IMAGE_COUNT_OPTIONS,
  isWeatherStationsTemporalMode,
  WeatherStationsTemporalMode,
} from '../../config/layers/weather-stations/controls.constants';

interface PersistedWeatherStationsSharedControlsState {
  opacity: number;
  zIndex: number | null;
  scaleVisible: boolean;
  temporalMode: WeatherStationsTemporalMode;
  gracePeriodHours: number;
  imageCount: number;
  selectedTilesetId: string | null;
  // When false, the renderer filters out stations whose `hasData` is false
  // (i.e. their last observation falls outside the grace-period window).
  // Default true preserves "show everything" until the user opts to declutter.
  showStationsWithoutData: boolean;
}

/**
 * Shape of ECMWF forecast state when persisted to localStorage. Indices
 * reference `availableForecasts[i]` in the layer's config; using indices
 * instead of raw timestamps keeps the persisted intent ("the latest run",
 * "the previous run") stable across sessions, even when the underlying
 * timestamps have rolled forward.
 */
interface PersistedEcmwfForecast {
  selectedForecastIndices: number[];
  forecastOpacityByIndex: Record<number, number>;
  secondaryRenderControlsByIndex: Record<number, ForecastRenderControls>;
}

type PersistedEcmwfTpLayerControls = Omit<EcmwfTpLayerControls, 'forecast'> & {
  forecast: PersistedEcmwfForecast;
};

type PersistedLayerControls =
  | GoesLayerControls
  | RadarLayerControls
  | WmsLayerControls
  | VectorLayerControls
  | PersistedEcmwfTpLayerControls
  | WrfLayerControls;

/**
 * Service responsible for managing layer controls, visibility, and playback state.
 *
 * This service handles:
 * - Layer activation/deactivation and visibility
 * - Opacity, zIndex, and layer ordering
 * - Tile layer playback controls (time index, speed, animation)
 * - Radar elevation selection
 * - Persistence of control state to localStorage
 *
 * The service maintains a reactive signal of layer controls that other components
 * can subscribe to for updates.
 */
@Injectable({
  providedIn: 'root',
})
export class LayerControlService {
  private readonly layersService = inject(LayersService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly engineService = inject(PlaybackEngineService);
  private readonly storage = inject(LocalStorageService);

  private readonly controls = signal<Map<string, LayerControls>>(new Map());
  private readonly weatherStationsSharedState = signal<PersistedWeatherStationsSharedControlsState>(
    {
      opacity: 1,
      zIndex: null,
      scaleVisible: false,
      temporalMode: WeatherStationsTemporalMode.LATEST,
      gracePeriodHours: DEFAULT_WEATHER_STATIONS_GRACE_PERIOD_HOURS,
      imageCount: 6,
      selectedTilesetId: null,
      showStationsWithoutData: true,
    },
  );

  /**
   * Transient buffer for ECMWF forecast indices loaded from localStorage. The
   * indices can't be translated to timestamps at `initializeControls()` time
   * because `availableForecasts` is only known after the config fetch. The
   * reconciliation effect drains this map on the first config emission per
   * layer.
   */
  private readonly pendingEcmwfIndices = new Map<
    string,
    {
      indices: number[];
      opacityByIndex: Record<number, number>;
      secondaryRenderControlsByIndex: Record<number, ForecastRenderControls>;
    }
  >();

  /**
   * Layer IDs for which a default forecast run has already been auto-seeded
   * during the current activation. Prevents re-seeding the first available
   * forecast on every config refresh after the user clears the selection.
   * Cleared on deactivation so the next activation can seed again.
   */
  private readonly autoSeededForecastLayers = new Set<string>();

  constructor() {
    this.loadWeatherStationsSharedState();
    this.initializeControls();

    // Auto-save controls when they change
    effect(() => {
      this.saveControls();
    });

    // Sync timeIndex to default cursor when config changes (auto-refresh).
    // For historical layers this points to the most recent frame; for forecasts,
    // to the first frame (closest to "now" within the forecast horizon).
    effect(() => {
      const configs = this.layerConfigService.configs();

      // Use untracked to avoid depending on controls signal (prevents infinite loops)
      untracked(() => {
        const activeEntries = this.activeLayers();

        for (const { layer } of activeEntries) {
          if (layer.type !== LayerType.TILE) continue;

          const config = configs.get(layer.id);
          if (!config || config.type !== LayerType.TILE) {
            continue;
          }

          const controls = this.getControls(layer.id);
          if (!controls || controls.type !== LayerType.TILE) {
            continue;
          }

          // Skip if playback is running — don't interrupt animation
          if (controls.playback.isPlaying) {
            continue;
          }

          // Auto-populate selectedForecastTimestamps for forecast-model layers
          // (ECMWF, WRF) when config arrives with data but selection is empty.
          // Mitigates a stale-localStorage scenario where the layer was activated
          // while the backend had no runs yet → selection stuck at [].
          if (
            (controls.category === LayerCategory.ECMWF_TP ||
              controls.category === LayerCategory.WRF) &&
            'forecast' in controls &&
            controls.forecast.selectedForecastTimestamps.length === 0 &&
            !this.autoSeededForecastLayers.has(layer.id) &&
            (config.category === LayerCategory.ECMWF_TP || config.category === LayerCategory.WRF) &&
            config.availableForecasts.length > 0
          ) {
            const firstForecast = config.availableForecasts[0];
            this.autoSeededForecastLayers.add(layer.id);
            if (controls.category === LayerCategory.WRF) {
              this.toggleWrfForecast(layer.id, firstForecast);
            } else {
              this.toggleEcmwfTpForecast(layer.id, firstForecast);
            }
          }

          if (config.availableTilesets.length === 0) continue;
          const defaultIndex = getDefaultCursorIndex(
            config.availableTilesets.length,
            layer.isForecast,
          );
          if (controls.playback.timeIndex !== defaultIndex) {
            this.setTimeIndex(layer.id, defaultIndex);
          }
        }
      });
    });

    // Reconcile ECMWF state against the fresh config on every config emission.
    // Two responsibilities, both triggered by the same configs() signal:
    //   1. Prune persisted forecast selections that are no longer available
    //      (tiles expire server-side after ~36h while localStorage can hold
    //      timestamps from days-old sessions). If nothing valid remains on a
    //      visible layer, deactivate it.
    //   2. Re-derive availableTilesets from the current selection. The full
    //      fetch in LayerConfigService.fetchEcmwfTpLayerConfig always seeds
    //      availableTilesets from forecasts[0], ignoring the user's selection;
    //      without this reconciliation, the 10s auto-refresh would clobber
    //      the union built by toggleEcmwfTpForecast. configsAreEqual inside
    //      updateConfigMap breaks the loop once availableTilesets matches.
    effect(() => {
      const configs = this.layerConfigService.configs();

      untracked(() => {
        for (const layer of this.layersService.getAllLayers()) {
          if (layer.type !== LayerType.TILE || layer.category !== LayerCategory.ECMWF_TP) {
            continue;
          }

          const config = configs.get(layer.id);
          if (
            !config ||
            config.type !== LayerType.TILE ||
            config.category !== LayerCategory.ECMWF_TP
          ) {
            continue;
          }

          const controls = this.controls().get(layer.id);
          if (
            !controls ||
            controls.type !== LayerType.TILE ||
            controls.category !== LayerCategory.ECMWF_TP
          ) {
            continue;
          }

          let ecmwfControls = controls as EcmwfTpLayerControls;

          // Hydration: translate persisted forecast indices to timestamps now
          // that availableForecasts is known. Indices come from localStorage;
          // they're buffered in pendingEcmwfIndices by initializeControls
          // because the config wasn't available then. After translation we
          // drop the buffer entry and re-read controls so the rest of the
          // effect operates on the hydrated state.
          const pending = this.pendingEcmwfIndices.get(layer.id);
          if (pending) {
            this.pendingEcmwfIndices.delete(layer.id);
            const translatedTs: string[] = [];
            for (const i of pending.indices) {
              const ts = config.availableForecasts[i];
              if (ts !== undefined) translatedTs.push(ts);
            }
            const translatedOpacity: Record<string, number> = {};
            for (const [idxStr, op] of Object.entries(pending.opacityByIndex)) {
              const ts = config.availableForecasts[Number(idxStr)];
              if (ts !== undefined) translatedOpacity[ts] = op;
            }
            const translatedSecondary: ForecastRenderControlsByForecast = {};
            for (const [idxStr, renderControls] of Object.entries(
              pending.secondaryRenderControlsByIndex,
            )) {
              const ts = config.availableForecasts[Number(idxStr)];
              if (ts !== undefined) {
                translatedSecondary[ts] = {
                  selectedRenderIds: [...renderControls.selectedRenderIds],
                  renderOpacity: { ...renderControls.renderOpacity },
                };
              }
            }
            this.updateControls(layer.id, (c) => {
              if (c.type !== LayerType.TILE || c.category !== LayerCategory.ECMWF_TP) return;
              const ec = c as EcmwfTpLayerControls;
              ec.forecast.selectedForecastTimestamps = translatedTs;
              ec.forecast.forecastOpacity = translatedOpacity;
              ec.forecast.renderControls = translatedSecondary;
            });
            const refreshed = this.controls().get(layer.id);
            if (
              refreshed?.type === LayerType.TILE &&
              refreshed.category === LayerCategory.ECMWF_TP
            ) {
              ecmwfControls = refreshed as EcmwfTpLayerControls;
            }
          }

          const available = new Set(config.availableForecasts);
          const validRenderIds = new Set(this.getForecastRenderIds(layer));
          const currentSelected = ecmwfControls.forecast.selectedForecastTimestamps;
          const validSelected = currentSelected.filter((ts) => available.has(ts));

          // First-activation race: the user toggled the layer ON before its
          // config was fetched, so activateLayer couldn't seed the default
          // forecast. Apply the default now that the config arrived — without
          // this, the "no valid selection on a visible layer" branch below
          // would deactivate the layer (flickering it off after one click).
          // The "all selections became stale" case is distinguished by
          // currentSelected.length > 0. If the user explicitly cleared the
          // selection, don't re-seed it on the next config refresh.
          const isFirstActivationRace =
            currentSelected.length === 0 &&
            !this.autoSeededForecastLayers.has(layer.id) &&
            ecmwfControls.visible &&
            config.availableForecasts.length > 0;
          const effectiveSelected = isFirstActivationRace
            ? [config.availableForecasts[0]]
            : validSelected;

          if (isFirstActivationRace) {
            this.autoSeededForecastLayers.add(layer.id);
          }

          const opacityEntries = Object.entries(ecmwfControls.forecast.forecastOpacity);
          const hasStaleOpacity = opacityEntries.some(([ts]) => !available.has(ts));
          const nextsecondaryRenderControls = this.pruneForecastsecondaryRenderControls(
            ecmwfControls.forecast.renderControls,
            available,
            validRenderIds,
          );
          const hasStalesecondaryRenderControls = !this.forecastsecondaryRenderControlsEqual(
            nextsecondaryRenderControls,
            ecmwfControls.forecast.renderControls,
          );
          const selectionMutated =
            effectiveSelected.length !== currentSelected.length ||
            effectiveSelected.some((ts, i) => ts !== currentSelected[i]);

          if (selectionMutated || hasStaleOpacity || hasStalesecondaryRenderControls) {
            this.updateControls(layer.id, (c) => {
              if (c.type !== LayerType.TILE || c.category !== LayerCategory.ECMWF_TP) return;
              const ec = c as EcmwfTpLayerControls;
              ec.forecast.selectedForecastTimestamps = effectiveSelected;
              if (hasStaleOpacity) {
                const pruned: Record<string, number> = {};
                for (const [ts, op] of opacityEntries) {
                  if (available.has(ts)) pruned[ts] = op;
                }
                ec.forecast.forecastOpacity = pruned;
              }
              if (hasStalesecondaryRenderControls) {
                ec.forecast.renderControls = nextsecondaryRenderControls;
              }
            });
          }

          if (effectiveSelected.length === 0) {
            const refreshedControls = this.controls().get(layer.id);
            if (
              refreshedControls?.type === LayerType.TILE &&
              refreshedControls.playback.isPlaying
            ) {
              this.stopPlayback(layer.id);
            }
            continue;
          }

          // Always re-derive availableTilesets from the effective selection —
          // even when nothing was pruned — so the fetch's forecasts[0]-based
          // seed gets replaced by the actual selection-based union.
          this.layerConfigService.updateEcmwfTpSelectedForecasts(layer.id, effectiveSelected);
        }
      });
    });

    effect(() => {
      const configs = this.layerConfigService.configs();

      untracked(() => {
        for (const layer of this.layersService.getAllLayers()) {
          if (layer.type !== LayerType.TILE || layer.category !== LayerCategory.WRF) {
            continue;
          }

          const config = configs.get(layer.id);
          if (!config || config.type !== LayerType.TILE || config.category !== LayerCategory.WRF) {
            continue;
          }

          const controls = this.controls().get(layer.id);
          if (
            !controls ||
            controls.type !== LayerType.TILE ||
            controls.category !== LayerCategory.WRF
          ) {
            continue;
          }

          const wrfControls = controls as WrfLayerControls;
          const availableForecasts = new Set(config.availableForecasts);
          const validSelected = wrfControls.forecast.selectedForecastTimestamps.filter((ts) =>
            availableForecasts.has(ts),
          );
          const opacityEntries = Object.entries(wrfControls.forecast.forecastOpacity);
          const hasStaleOpacity = opacityEntries.some(([ts]) => !availableForecasts.has(ts));
          const validRenderIds = new Set(this.getForecastRenderIds(layer));
          const nextsecondaryRenderControls = this.pruneForecastsecondaryRenderControls(
            wrfControls.forecast.renderControls,
            availableForecasts,
            validRenderIds,
          );
          const hasStalesecondaryRenderControls = !this.forecastsecondaryRenderControlsEqual(
            nextsecondaryRenderControls,
            wrfControls.forecast.renderControls,
          );
          const selectionMutated =
            validSelected.length !== wrfControls.forecast.selectedForecastTimestamps.length ||
            validSelected.some(
              (ts, index) => ts !== wrfControls.forecast.selectedForecastTimestamps[index],
            );

          if (!selectionMutated && !hasStaleOpacity && !hasStalesecondaryRenderControls) {
            continue;
          }

          this.updateControls(layer.id, (c) => {
            if (c.type !== LayerType.TILE || c.category !== LayerCategory.WRF) return;
            const wrf = c as WrfLayerControls;
            wrf.forecast.selectedForecastTimestamps = validSelected;
            if (hasStaleOpacity) {
              const pruned: Record<string, number> = {};
              for (const [ts, op] of opacityEntries) {
                if (availableForecasts.has(ts)) pruned[ts] = op;
              }
              wrf.forecast.forecastOpacity = pruned;
            }
            if (hasStalesecondaryRenderControls) {
              wrf.forecast.renderControls = nextsecondaryRenderControls;
            }
          });

          if (validSelected.length === 0) {
            const refreshedControls = this.controls().get(layer.id);
            if (
              refreshedControls?.type === LayerType.TILE &&
              refreshedControls.playback.isPlaying
            ) {
              this.stopPlayback(layer.id);
            }
            continue;
          }

          if (validSelected.length > 0) {
            this.layerConfigService.updateWrfSelectedForecasts(layer.id, validSelected);
          }
        }
      });
    });
  }

  isWeatherStationsLayer(layerId: string): boolean {
    const layer = this.layersService.getLayerById(layerId);
    return layer?.category === LayerCategory.WEATHER_STATIONS;
  }

  getWeatherStationsSharedOpacity(): number {
    return this.weatherStationsSharedState().opacity;
  }

  getWeatherStationsSharedZIndex(): number | null {
    return this.weatherStationsSharedState().zIndex;
  }

  isWeatherStationsScaleVisible(): boolean {
    return this.weatherStationsSharedState().scaleVisible;
  }

  getWeatherStationsTemporalMode(): WeatherStationsTemporalMode {
    return this.weatherStationsSharedState().temporalMode;
  }

  getWeatherStationsGracePeriodHours(): number {
    return this.weatherStationsSharedState().gracePeriodHours;
  }

  getWeatherStationsSelectedTilesetId(): string | null {
    return this.weatherStationsSharedState().selectedTilesetId;
  }

  getWeatherStationsImageCount(): number {
    return this.weatherStationsSharedState().imageCount;
  }

  captureWeatherStationsSharedFromControls(controls: LayerControls): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      opacity: this.clampWeatherStationsOpacity(controls.opacity),
      zIndex: Number.isFinite(controls.zIndex) ? Math.max(0, controls.zIndex) : null,
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsSharedOpacity(opacity: number): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      opacity: this.clampWeatherStationsOpacity(opacity),
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsSharedZIndex(zIndex: number | null): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      zIndex: zIndex === null ? null : Math.max(0, Math.round(zIndex)),
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsScaleVisible(scaleVisible: boolean): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      scaleVisible,
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsTemporalMode(temporalMode: WeatherStationsTemporalMode): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      temporalMode,
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsGracePeriodHours(gracePeriodHours: number): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      gracePeriodHours: Math.max(0, Math.min(24, Math.round(gracePeriodHours))),
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsImageCount(imageCount: number): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      imageCount: this.normalizeWeatherStationsImageCount(imageCount),
    }));
    this.saveWeatherStationsSharedState();
  }

  setWeatherStationsSelectedTilesetId(selectedTilesetId: string | null): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      selectedTilesetId,
    }));
    this.saveWeatherStationsSharedState();
  }

  getWeatherStationsShowStationsWithoutData(): boolean {
    return this.weatherStationsSharedState().showStationsWithoutData;
  }

  setWeatherStationsShowStationsWithoutData(showStationsWithoutData: boolean): void {
    this.weatherStationsSharedState.update((state) => ({
      ...state,
      showStationsWithoutData,
    }));
    this.saveWeatherStationsSharedState();
  }

  // Public readonly signal so component templates can react via computed/effect
  // without having to call the getter inside a tracking context.
  readonly weatherStationsShowStationsWithoutData = computed(
    () => this.weatherStationsSharedState().showStationsWithoutData,
  );

  // ============================================================================
  // Public Computed Signals
  // ============================================================================

  readonly activeLayers = computed(() => {
    const allLayers = this.layersService.getAllLayers();
    return allLayers
      .map((layer) => {
        const controls = this.controls().get(layer.id);
        return controls?.visible ? { layer, controls } : null;
      })
      .filter((item): item is ActiveLayerEntry => item !== null)
      .sort((a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0));
  });

  // ============================================================================
  // Public Getters
  // ============================================================================

  getActiveLayersForGroup(groupId: ActiveLayerGroupId): ActiveLayerEntry[] {
    return this.activeLayers().filter(({ layer }) => layer.zIndexGroup === groupId);
  }

  getControls(layerId: string): LayerControls {
    const controls = this.controls().get(layerId);
    if (!controls) throw new Error(`Controls for layer '${layerId}' not found`);
    return controls;
  }

  getAbsoluteZIndex(layerId: string, controls: LayerControls): number {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) throw new Error(`Layer '${layerId}' not found`);
    const baseOffset = ACTIVE_LAYER_GROUP_DEFINITIONS[layer.zIndexGroup].zIndexRange.min;
    return baseOffset + controls.zIndex;
  }

  isPlaying(layerId: string): boolean {
    const controls = this.getControls(layerId);
    if (controls.type !== LayerType.TILE) return false;
    return controls.playback?.isPlaying ?? false;
  }

  getSelectedElevationsForLayer(layerId: string): RadarElevation[] {
    const controls = this.getControls(layerId);
    if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.RADAR) {
      return [];
    }

    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.RADAR) {
      return [];
    }

    const selectedIds = controls.elevation.selectedElevationIds;
    return layer.availableElevations.filter((elev) => selectedIds.includes(elev.id));
  }

  // ============================================================================
  // Public Actions - Layer Visibility
  // ============================================================================

  toggleLayer(layerId: string): void {
    if (this.isActive(layerId)) {
      this.deactivateLayer(layerId);
    } else {
      this.activateLayer(layerId);
    }
  }

  activateLayer(layerId: string): void {
    if (this.isActive(layerId)) return;

    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return;

    this.updateControls(layerId, (controls) => {
      controls.visible = true;
      controls.zIndex = this.getNextZIndex(layer.zIndexGroup);

      switch (controls.type) {
        case LayerType.TILE:
          if (controls.playback.timeIndex === undefined) {
            const availablePeriods = this.getAvailablePeriodsForLayer(layerId);
            if (availablePeriods && availablePeriods.length > 0) {
              const isForecast = layer.type === LayerType.TILE && layer.isForecast;
              controls.playback.timeIndex = getDefaultCursorIndex(
                availablePeriods.length,
                isForecast,
              );
            }
          }

          switch (controls.category) {
            case LayerCategory.RADAR:
              if (
                controls.elevation.selectedElevationIds.length === 0 &&
                layer.type === LayerType.TILE &&
                layer.category === LayerCategory.RADAR
              ) {
                const radarLayer = layer as RadarTileLayer;
                const defaultElevations = radarLayer.availableElevations
                  .filter((elev) => elev.activeByDefault)
                  .map((elev) => elev.id);

                if (defaultElevations.length > 0) {
                  controls.elevation.selectedElevationIds = defaultElevations;
                }
              }
              break;
            case LayerCategory.GOES_19:
              break;
            case LayerCategory.ECMWF_TP: {
              this.autoSeededForecastLayers.add(layerId);
              const ecmwfControls = controls as EcmwfTpLayerControls;
              if (ecmwfControls.forecast.selectedForecastTimestamps.length === 0) {
                const ecmwfConfig = this.layerConfigService.getConfig(layerId);
                if (
                  ecmwfConfig &&
                  ecmwfConfig.type === LayerType.TILE &&
                  ecmwfConfig.category === LayerCategory.ECMWF_TP
                ) {
                  // Default: select the most recent forecast
                  const firstForecast = ecmwfConfig.availableForecasts[0];
                  if (firstForecast) {
                    ecmwfControls.forecast.selectedForecastTimestamps = [firstForecast];
                    this.layerConfigService.updateEcmwfTpSelectedForecasts(layerId, [
                      firstForecast,
                    ]);
                  }
                }
              }
              break;
            }
            case LayerCategory.WRF: {
              this.autoSeededForecastLayers.add(layerId);
              const wrfControls = controls as WrfLayerControls;
              if (wrfControls.forecast.selectedForecastTimestamps.length === 0) {
                const wrfConfig = this.layerConfigService.getConfig(layerId);
                if (
                  wrfConfig &&
                  wrfConfig.type === LayerType.TILE &&
                  wrfConfig.category === LayerCategory.WRF
                ) {
                  const firstInit = wrfConfig.availableForecasts[0];
                  if (firstInit) {
                    wrfControls.forecast.selectedForecastTimestamps = [firstInit];
                  }
                }
              }
              break;
            }
          }
          break;
        case LayerType.VECTOR:
          break;
        case LayerType.WMS:
          break;
      }
    });
  }

  deactivateLayer(layerId: string): void {
    if (!this.isActive(layerId)) return;

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback.isPlaying) {
        this.stopPlayback(layerId);
      }

      controls.visible = false;
    });

    this.autoSeededForecastLayers.delete(layerId);
  }

  replaceAllWithLayer(layerId: string): void {
    this.activeLayers().forEach(({ layer }) => {
      if (layer.id !== layerId) {
        this.deactivateLayer(layer.id);
      }
    });

    this.activateLayer(layerId);
  }

  // ============================================================================
  // Public Actions - Layer Properties
  // ============================================================================

  setOpacity(layerId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      controls.opacity = clampedOpacity;
    });

    if (this.isWeatherStationsLayer(layerId)) {
      this.setWeatherStationsSharedOpacity(clampedOpacity);
    }
  }

  setZIndex(layerId: string, zIndex: number): void {
    const normalizedZIndex = Math.max(0, Math.round(zIndex));

    this.updateControls(layerId, (controls) => {
      controls.zIndex = normalizedZIndex;
    });

    if (this.isWeatherStationsLayer(layerId)) {
      this.setWeatherStationsSharedZIndex(normalizedZIndex);
    }
  }

  setTimeIndex(layerId: string, timeIndex: number): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.timeIndex = timeIndex;
      }
    });
  }

  toggleElevation(layerId: string, elevationId: string): void {
    this.updateControls(layerId, (controls) => {
      switch (controls.type) {
        case LayerType.TILE:
          switch (controls.category) {
            case LayerCategory.RADAR:
              const currentSelected = controls.elevation.selectedElevationIds;
              const index = currentSelected.indexOf(elevationId);

              if (index === -1) {
                controls.elevation.selectedElevationIds = [...currentSelected, elevationId];
              } else {
                controls.elevation.selectedElevationIds = currentSelected.filter(
                  (id) => id !== elevationId,
                );
              }
              break;
            default:
              throw new Error(`Elevation control only applies to radar layers`);
          }
          break;
        default:
          throw new Error(`Elevation control only applies to tile layers`);
      }
    });

    const updatedControls = this.getControls(layerId);
    if (
      updatedControls.type === LayerType.TILE &&
      updatedControls.category === LayerCategory.RADAR &&
      updatedControls.elevation.selectedElevationIds.length === 0 &&
      updatedControls.playback.isPlaying
    ) {
      this.stopPlayback(layerId);
    }
  }

  setSelectedElevations(layerId: string, elevationIds: string[]): void {
    this.updateControls(layerId, (controls) => {
      switch (controls.type) {
        case LayerType.TILE:
          switch (controls.category) {
            case LayerCategory.RADAR:
              controls.elevation.selectedElevationIds = [...elevationIds];
              break;
            default:
              throw new Error(`Elevation control only applies to radar layers`);
          }
          break;
        default:
          throw new Error(`Elevation control only applies to tile layers`);
      }
    });

    if (elevationIds.length === 0) {
      const updatedControls = this.getControls(layerId);
      if (updatedControls.type === LayerType.TILE && updatedControls.playback.isPlaying) {
        this.stopPlayback(layerId);
      }
    }
  }

  setElevationOpacity(layerId: string, elevationId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.RADAR) {
        controls.elevation.elevationOpacity[elevationId] = clampedOpacity;
      }
    });
  }

  setImageCount(layerId: string, count: number): void {
    const wasPlaying = this.isPlaying(layerId);
    const controls = this.getControls(layerId);

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE) {
        if (!controls.playback) {
          controls.playback = {
            isPlaying: false,
            speed: 1.0,
            timeIndex: 0,
            imageCount: count,
          };
        } else {
          controls.playback.imageCount = count;
        }
      }
    });

    if (controls && controls.type === LayerType.TILE) {
      const newTimeIndex = this.layerConfigService.calculateTimeIndexForRange(layerId, count);
      if (newTimeIndex !== undefined) {
        this.setTimeIndex(layerId, newTimeIndex);
      }
    }

    if (count === 1) {
      if (wasPlaying) {
        this.stopPlayback(layerId);
      }
    } else {
      if (wasPlaying) {
        this.stopPlayback(layerId);
        setTimeout(() => {
          this.startPlayback(layerId);
        }, 0);
      }
    }
  }

  toggleEcmwfTpForecast(layerId: string, forecastTs: string): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF_TP) return;
      const ecmwf = controls as EcmwfTpLayerControls;
      const current = ecmwf.forecast.selectedForecastTimestamps;
      const index = current.indexOf(forecastTs);
      if (index === -1) {
        ecmwf.forecast.selectedForecastTimestamps = [...current, forecastTs];
        const renderIds = this.getForecastRenderIds(
          this.layersService.getLayerById(layerId) as Layer,
        );
        ecmwf.forecast.renderControls[forecastTs] = this.ensureForecastsecondaryRenderControls(
          ecmwf.forecast.renderControls[forecastTs],
          renderIds,
        );
      } else {
        ecmwf.forecast.selectedForecastTimestamps = current.filter((ts) => ts !== forecastTs);
        delete ecmwf.forecast.renderControls[forecastTs];
      }
    });

    const updatedControls = this.getControls(layerId) as EcmwfTpLayerControls;
    const newConfig = this.layerConfigService.updateEcmwfTpSelectedForecasts(
      layerId,
      updatedControls.forecast.selectedForecastTimestamps,
    );

    if (updatedControls.forecast.selectedForecastTimestamps.length === 0) {
      if (updatedControls.playback.isPlaying) {
        this.stopPlayback(layerId);
      }
      return;
    }

    if (!newConfig) return;
    const newUnionCount = newConfig.availableTilesets.length;
    const layer = this.layersService.getLayerById(layerId);

    if (
      updatedControls.playback.timeIndex !== undefined &&
      updatedControls.playback.timeIndex >= newUnionCount
    ) {
      const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
      this.setTimeIndex(layerId, getDefaultCursorIndex(newUnionCount, isForecast));
    }

    if (
      newUnionCount > 0 &&
      layer?.type === LayerType.TILE &&
      layer.category === LayerCategory.ECMWF_TP
    ) {
      const options = buildEcmwfTpFrameOptions(layer.availablePeriods ?? [1], newUnionCount);
      if (!options.includes(updatedControls.playback.imageCount)) {
        this.setImageCount(layerId, newUnionCount);
      }
    }
  }

  setEcmwfTpForecastOpacity(layerId: string, forecastTs: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.ECMWF_TP) {
        (controls as EcmwfTpLayerControls).forecast.forecastOpacity[forecastTs] = clampedOpacity;
      }
    });
  }

  setEcmwfTpForecastRenderVisible(
    layerId: string,
    forecastTs: string,
    renderId: string,
    visible: boolean,
  ): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF_TP) return;
      const ecmwf = controls as EcmwfTpLayerControls;
      const renderIds = this.getForecastRenderIds(
        this.layersService.getLayerById(layerId) as Layer,
      );
      const forecastControls = this.ensureForecastsecondaryRenderControls(
        ecmwf.forecast.renderControls[forecastTs],
        renderIds,
      );
      forecastControls.selectedRenderIds = visible
        ? [...new Set([...forecastControls.selectedRenderIds, renderId])]
        : forecastControls.selectedRenderIds.filter((id) => id !== renderId);
      ecmwf.forecast.renderControls[forecastTs] = forecastControls;
    });
  }

  setEcmwfTpForecastRenderOpacity(
    layerId: string,
    forecastTs: string,
    renderId: string,
    opacity: number,
  ): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF_TP) return;
      const ecmwf = controls as EcmwfTpLayerControls;
      const renderIds = this.getForecastRenderIds(
        this.layersService.getLayerById(layerId) as Layer,
      );
      const forecastControls = this.ensureForecastsecondaryRenderControls(
        ecmwf.forecast.renderControls[forecastTs],
        renderIds,
      );
      forecastControls.renderOpacity[renderId] = clampedOpacity;
      ecmwf.forecast.renderControls[forecastTs] = forecastControls;
    });
  }

  toggleWrfForecast(layerId: string, initTag: string): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.WRF) return;
      const wrf = controls as WrfLayerControls;
      const current = wrf.forecast.selectedForecastTimestamps;
      const index = current.indexOf(initTag);
      if (index === -1) {
        wrf.forecast.selectedForecastTimestamps = [...current, initTag];
        const renderIds = this.getForecastRenderIds(
          this.layersService.getLayerById(layerId) as Layer,
        );
        wrf.forecast.renderControls[initTag] = this.ensureForecastsecondaryRenderControls(
          wrf.forecast.renderControls[initTag],
          renderIds,
        );
      } else {
        wrf.forecast.selectedForecastTimestamps = current.filter((ts) => ts !== initTag);
        delete wrf.forecast.renderControls[initTag];
      }
    });

    const updatedControls = this.getControls(layerId) as WrfLayerControls;
    const newConfig = this.layerConfigService.updateWrfSelectedForecasts(
      layerId,
      updatedControls.forecast.selectedForecastTimestamps,
    );

    if (updatedControls.forecast.selectedForecastTimestamps.length === 0) {
      if (updatedControls.playback.isPlaying) {
        this.stopPlayback(layerId);
      }
      return;
    }

    if (!newConfig) return;
    const newUnionCount = newConfig.availableTilesets.length;
    const layer = this.layersService.getLayerById(layerId);

    if (
      updatedControls.playback.timeIndex !== undefined &&
      updatedControls.playback.timeIndex >= newUnionCount
    ) {
      const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
      this.setTimeIndex(layerId, getDefaultCursorIndex(newUnionCount, isForecast));
    }

    if (
      newUnionCount > 0 &&
      layer?.type === LayerType.TILE &&
      layer.category === LayerCategory.WRF
    ) {
      const options = buildEcmwfTpFrameOptions(layer.availablePeriods ?? [1], newUnionCount);
      if (!options.includes(updatedControls.playback.imageCount)) {
        this.setImageCount(layerId, newUnionCount);
      }
    }
  }

  setWrfForecastOpacity(layerId: string, initTag: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.WRF) {
        (controls as WrfLayerControls).forecast.forecastOpacity[initTag] = clampedOpacity;
      }
    });
  }

  setWrfForecastRenderVisible(
    layerId: string,
    initTag: string,
    renderId: string,
    visible: boolean,
  ): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.WRF) return;
      const wrf = controls as WrfLayerControls;
      const renderIds = this.getForecastRenderIds(
        this.layersService.getLayerById(layerId) as Layer,
      );
      const forecastControls = this.ensureForecastsecondaryRenderControls(
        wrf.forecast.renderControls[initTag],
        renderIds,
      );
      forecastControls.selectedRenderIds = visible
        ? [...new Set([...forecastControls.selectedRenderIds, renderId])]
        : forecastControls.selectedRenderIds.filter((id) => id !== renderId);
      wrf.forecast.renderControls[initTag] = forecastControls;
    });
  }

  setWrfForecastRenderOpacity(
    layerId: string,
    initTag: string,
    renderId: string,
    opacity: number,
  ): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.WRF) return;
      const wrf = controls as WrfLayerControls;
      const renderIds = this.getForecastRenderIds(
        this.layersService.getLayerById(layerId) as Layer,
      );
      const forecastControls = this.ensureForecastsecondaryRenderControls(
        wrf.forecast.renderControls[initTag],
        renderIds,
      );
      forecastControls.renderOpacity[renderId] = clampedOpacity;
      wrf.forecast.renderControls[initTag] = forecastControls;
    });
  }

  setActiveGroupLayersOrder(
    activeLayerGroupId: ActiveLayerGroupId,
    orderedLayerIds: string[],
  ): void {
    this.getActiveLayersForGroup(activeLayerGroupId).forEach(({ layer }) => {
      if (!orderedLayerIds.includes(layer.id)) {
        this.deactivateLayer(layer.id);
      }
    });

    const filteredIds = orderedLayerIds.filter((id) => this.isActive(id));
    const maxIndex = filteredIds.length - 1;

    filteredIds.forEach((layerId: string, uiIndex: number) => {
      this.updateControls(layerId, (controls) => {
        if (controls.visible) {
          controls.zIndex = maxIndex - uiIndex;
        }
      });
    });

    const activeWeatherStationLayerId = filteredIds.find((layerId) =>
      this.isWeatherStationsLayer(layerId),
    );

    if (activeWeatherStationLayerId) {
      const controls = this.getControls(activeWeatherStationLayerId);
      if (controls.visible) {
        this.setWeatherStationsSharedZIndex(controls.zIndex ?? 0);
      }
    }
  }

  // ============================================================================
  // Public Actions - Playback
  // ============================================================================

  setPlaySpeed(layerId: string, speed: number): void {
    const clampedSpeed = Math.max(0.4, Math.min(10, speed));

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE) {
        controls.playback.speed = clampedSpeed;
      }
    });

    if (this.isPlaying(layerId)) {
      this.startPlayback(layerId);
    }
  }

  togglePlayback(layerId: string): void {
    if (this.isPlaying(layerId)) {
      this.stopPlayback(layerId);
    } else {
      this.startPlayback(layerId);
    }
  }

  startPlayback(layerId: string): void {
    if (!this.isActive(layerId)) return;

    const controls = this.getControls(layerId);
    if (controls.type !== LayerType.TILE) return;

    const availablePeriods = this.getAvailablePeriodsForLayer(layerId);
    if (!availablePeriods || availablePeriods.length === 0) return;

    const imageCount = controls.playback.imageCount;
    const layer = this.layersService.getLayerById(layerId);
    const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
    const minTimeIndex = computeWindowStart(availablePeriods.length, imageCount, isForecast);
    const maxTimeIndex = Math.min(minTimeIndex + imageCount - 1, availablePeriods.length - 1);
    const frameCount = maxTimeIndex - minTimeIndex + 1;
    const fallbackTimeIndex = getDefaultCursorIndex(availablePeriods.length, isForecast);
    const currentTimeIndex = controls.playback.timeIndex ?? fallbackTimeIndex;
    const startTimeIndex = Math.max(minTimeIndex, Math.min(currentTimeIndex, maxTimeIndex));
    const startFrameIndex = startTimeIndex - minTimeIndex;

    if (frameCount < 2) return;

    const speed = controls.playback.speed;

    this.engineService.register(layerId, frameCount, speed);
    this.engineService.setFrameIndex(layerId, startFrameIndex);

    this.updateControls(layerId, (c) => {
      if (c.type === LayerType.TILE && c.playback) {
        c.playback.isPlaying = true;
        c.playback.timeIndex = startTimeIndex;
      }
    });

    this.engineService.play(layerId, (frameIndex) => {
      this.updateControls(layerId, (c) => {
        if (c.type === LayerType.TILE && c.playback) {
          c.playback.timeIndex = minTimeIndex + frameIndex;
        }
      });
    });
  }

  stopPlayback(layerId: string): void {
    if (!this.isActive(layerId)) return;
    if (!this.isPlaying(layerId)) return;

    this.engineService.pause(layerId);

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.isPlaying = false;
      }
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private isActive(layerId: string): boolean {
    const controls = this.getControls(layerId);
    return controls?.visible ?? false;
  }

  private getAvailablePeriodsForLayer(layerId: string): TilesetEntry[] | undefined {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) throw new Error(`Layer '${layerId}' not found`);

    switch (layer.type) {
      case LayerType.TILE:
        switch (layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
          case LayerCategory.ECMWF_TP:
          case LayerCategory.WRF:
            return this.layerConfigService.getAvailableTilesets(layerId);
          default:
            throw new Error(`Unsupported tile layer category for playback`);
        }
      default:
        throw new Error(`Only tile layers have available periods for playback`);
    }
  }

  private getNextZIndex(activeLayerGroup: ActiveLayerGroupId): number {
    const activeLayersInGroup = this.activeLayers().filter(
      ({ layer }) => layer.zIndexGroup === activeLayerGroup,
    );

    if (activeLayersInGroup.length === 0) {
      return 0;
    }

    const maxZIndexInGroup = Math.max(
      ...activeLayersInGroup.map(({ controls }) => controls.zIndex ?? 0),
    );

    return maxZIndexInGroup + 1;
  }

  private updateControls(layerId: string, updateFn: (controls: LayerControls) => void): void {
    this.controls.update((controlsMap) => {
      const newMap = new Map(controlsMap);
      const controls = newMap.get(layerId);
      if (controls) {
        const updatedControls = structuredClone(controls);
        updateFn(updatedControls);
        newMap.set(layerId, updatedControls);
      }
      return newMap;
    });
  }

  // ============================================================================
  // Private Initialization & Persistence
  // ============================================================================

  private initializeControls(): void {
    const savedState = this.loadControls();

    const stateMap = new Map(savedState ? savedState.map((s) => [s.id, s]) : []);
    const controlsMap = new Map<string, LayerControls>();

    const maxSavedZIndex = savedState
      ? Math.max(-1, ...savedState.filter((c) => c.visible).map((c) => c.zIndex ?? 0))
      : -1;
    let initialZIndex = maxSavedZIndex + 1;

    for (const layer of this.layersService.getAllLayers()) {
      let controls: LayerControls;
      const savedControls = stateMap.get(layer.id);

      if (savedControls) {
        controls = {
          ...this.fromPersistedControls(savedControls),
          zIndex: savedControls.zIndex ?? 0,
        };
        if (controls.type === LayerType.TILE) {
          controls.playback = {
            ...controls.playback,
            isPlaying: false,
          };

          if (controls.playback.timeIndex !== undefined) {
            try {
              const availablePeriods = this.getAvailablePeriodsForLayer(layer.id);
              if (availablePeriods && availablePeriods.length > 0) {
                const maxIndex = availablePeriods.length - 1;
                const isForecast = layer.type === LayerType.TILE && layer.isForecast;
                const defaultIndex = getDefaultCursorIndex(availablePeriods.length, isForecast);
                if (controls.playback.timeIndex > maxIndex) {
                  controls.playback.timeIndex = defaultIndex;
                } else if (controls.playback.timeIndex < 0) {
                  controls.playback.timeIndex = 0;
                }
              }
            } catch {
            }
          }
        }
      } else if (DEFAULT_ACTIVE_LAYERS.includes(layer.id)) {
        // Apply default active layers
        controls = this.createControlsForLayer(layer);
        controls.visible = true;
        controls.zIndex = initialZIndex++;
      } else {
        // Create default inactive controls
        controls = this.createControlsForLayer(layer);
      }

      controlsMap.set(layer.id, controls);
    }

    this.controls.set(controlsMap);
  }

  private createDefaultBaseControls(layer: Layer): BaseLayerControls {
    return {
      id: layer.id,
      visible: false,
      opacity: DEFAULT_LAYER_CONTROLS.opacity,
      zIndex: 0,
    };
  }

  private createControlsForLayer(layer: Layer): LayerControls {
    const baseControls = this.createDefaultBaseControls(layer);

    switch (layer.type) {
      case LayerType.WMS:
        return {
          ...baseControls,
          type: LayerType.WMS,
        };
      case LayerType.VECTOR:
        return {
          ...baseControls,
          type: LayerType.VECTOR,
        };
      case LayerType.TILE:
        const baseTileControls: TileLayerControls = {
          ...baseControls,
          type: LayerType.TILE,
          playback: {
            isPlaying: false,
            timeIndex: undefined, // Will be set to latest when config loads
            speed: DEFAULT_LAYER_CONTROLS.playbackSpeed,
            imageCount: DEFAULT_LAYER_CONTROLS.imageCount,
          },
        };
        switch (layer.category) {
          case LayerCategory.GOES_19:
            return {
              ...baseTileControls,
              category: layer.category!,
            } as GoesLayerControls;
          case LayerCategory.RADAR:
            const radarLayer = layer as RadarTileLayer;
            const defaultElevations = radarLayer.availableElevations
              .filter((elev) => elev.activeByDefault)
              .map((elev) => elev.id);

            return {
              ...baseTileControls,
              category: layer.category!,
              elevation: {
                selectedElevationIds: defaultElevations,
                elevationOpacity: {},
              },
            } as RadarLayerControls;
          case LayerCategory.ECMWF_TP:
            return {
              ...baseTileControls,
              category: LayerCategory.ECMWF_TP,
              availablePeriods: (layer as EcmwfTpTileLayer).availablePeriods,
              forecast: {
                selectedForecastTimestamps: [],
                forecastOpacity: {},
                renderControls: {},
              },
            } as EcmwfTpLayerControls;
          case LayerCategory.WRF:
            return {
              ...baseTileControls,
              category: LayerCategory.WRF,
              availablePeriods: (layer as WrfTileLayer).availablePeriods,
              forecast: {
                selectedForecastTimestamps: [],
                forecastOpacity: {},
                renderControls: {},
              },
            } as WrfLayerControls;
          default:
            throw new Error(`Layer category does not have a defined controls template`);
        }
      default:
        throw new Error(`Unsupported layer type`);
    }
  }

  private saveControls(): void {
    const state = this.activeLayers().map(({ controls }) => this.toPersistedControls(controls));
    this.storage.setJson(STORAGE_KEYS.ACTIVE_LAYERS, state);
  }

  private toPersistedControls(controls: LayerControls): PersistedLayerControls {
    if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF_TP) {
      return controls;
    }
    const ecmwf = controls as EcmwfTpLayerControls;
    const config = this.layerConfigService.getConfig(ecmwf.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    const availableForecasts = config?.availableForecasts ?? [];
    const selectedForecastIndices: number[] = [];
    for (const ts of ecmwf.forecast.selectedForecastTimestamps) {
      const idx = availableForecasts.indexOf(ts);
      if (idx >= 0) selectedForecastIndices.push(idx);
    }
    const forecastOpacityByIndex: Record<number, number> = {};
    for (const [ts, op] of Object.entries(ecmwf.forecast.forecastOpacity)) {
      const idx = availableForecasts.indexOf(ts);
      if (idx >= 0) forecastOpacityByIndex[idx] = op;
    }
    const secondaryRenderControlsByIndex: Record<number, ForecastRenderControls> = {};
    for (const [ts, renderControls] of Object.entries(ecmwf.forecast.renderControls)) {
      const idx = availableForecasts.indexOf(ts);
      if (idx >= 0) {
        secondaryRenderControlsByIndex[idx] = {
          selectedRenderIds: [...renderControls.selectedRenderIds],
          renderOpacity: { ...renderControls.renderOpacity },
        };
      }
    }
    return {
      ...ecmwf,
      forecast: {
        selectedForecastIndices,
        forecastOpacityByIndex,
        secondaryRenderControlsByIndex,
      },
    };
  }

  private fromPersistedControls(persisted: PersistedLayerControls): LayerControls {
    if (persisted.type !== LayerType.TILE || persisted.category !== LayerCategory.ECMWF_TP) {
      return persisted as LayerControls;
    }
    const ecmwfPersisted = persisted as PersistedEcmwfTpLayerControls;
    this.pendingEcmwfIndices.set(ecmwfPersisted.id, {
      indices: [...(ecmwfPersisted.forecast.selectedForecastIndices ?? [])],
      opacityByIndex: { ...(ecmwfPersisted.forecast.forecastOpacityByIndex ?? {}) },
      secondaryRenderControlsByIndex: {
        ...(ecmwfPersisted.forecast.secondaryRenderControlsByIndex ?? {}),
      },
    });
    return {
      ...ecmwfPersisted,
      forecast: {
        selectedForecastTimestamps: [],
        forecastOpacity: {},
        renderControls: {},
      },
    } as EcmwfTpLayerControls;
  }

  private getForecastRenderIds(layer: Layer): string[] {
    if (layer.type !== LayerType.TILE) {
      return [];
    }

    if (layer.category === LayerCategory.ECMWF_TP) {
      const secondary = (layer as EcmwfTpTileLayer).secondaryRender;
      // PRIMARY_RENDER_ID always first so the primary tile is always independently controllable.
      return secondary ? [PRIMARY_RENDER_ID, secondary.id] : [PRIMARY_RENDER_ID];
    }

    if (layer.category === LayerCategory.WRF) {
      const secondaryIds = ((layer as WrfTileLayer).secondaryRenders ?? []).map((r) => r.id);
      return [PRIMARY_RENDER_ID, ...secondaryIds];
    }

    return [];
  }

  private pruneForecastsecondaryRenderControls(
    controlsByForecast: ForecastRenderControlsByForecast,
    validForecasts: ReadonlySet<string>,
    validRenderIds: ReadonlySet<string>,
  ): ForecastRenderControlsByForecast {
    const next: ForecastRenderControlsByForecast = {};

    for (const [forecastTs, renderControls] of Object.entries(controlsByForecast)) {
      if (!validForecasts.has(forecastTs)) {
        continue;
      }

      const nextSelectedSecondaryRenderIds = renderControls.selectedRenderIds.filter((renderId) =>
        validRenderIds.has(renderId),
      );
      const nextSecondaryRenderOpacity: Record<string, number> = {};
      for (const [renderId, opacity] of Object.entries(renderControls.renderOpacity)) {
        if (validRenderIds.has(renderId)) {
          nextSecondaryRenderOpacity[renderId] = opacity;
        }
      }

      if (
        nextSelectedSecondaryRenderIds.length > 0 ||
        Object.keys(nextSecondaryRenderOpacity).length > 0
      ) {
        next[forecastTs] = {
          selectedRenderIds: nextSelectedSecondaryRenderIds,
          renderOpacity: nextSecondaryRenderOpacity,
        };
      }
    }

    return next;
  }

  private forecastsecondaryRenderControlsEqual(
    left: ForecastRenderControlsByForecast,
    right: ForecastRenderControlsByForecast,
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private ensureForecastsecondaryRenderControls(
    controls: ForecastRenderControls | undefined,
    renderIds: readonly string[],
  ): ForecastRenderControls {
    if (controls) {
      return {
        selectedRenderIds: [...controls.selectedRenderIds],
        renderOpacity: { ...controls.renderOpacity },
      };
    }

    return {
      selectedRenderIds: [...renderIds],
      renderOpacity: {},
    };
  }

  private loadControls(): PersistedLayerControls[] | undefined {
    return this.storage.getJson<PersistedLayerControls[]>(STORAGE_KEYS.ACTIVE_LAYERS) ?? undefined;
  }

  private clampWeatherStationsOpacity(opacity: number): number {
    return Math.max(0, Math.min(1, opacity));
  }

  private loadWeatherStationsSharedState(): void {
    const parsed = this.storage.getJson<Partial<PersistedWeatherStationsSharedControlsState>>(
      STORAGE_KEYS.WEATHER_STATIONS_SHARED_CONTROLS,
    );
    if (!parsed) return;

    this.weatherStationsSharedState.set({
        opacity:
          typeof parsed.opacity === 'number'
            ? this.clampWeatherStationsOpacity(parsed.opacity)
            : this.weatherStationsSharedState().opacity,
        zIndex:
          typeof parsed.zIndex === 'number' && Number.isFinite(parsed.zIndex)
            ? Math.max(0, Math.round(parsed.zIndex))
            : null,
        scaleVisible:
          typeof parsed.scaleVisible === 'boolean'
            ? parsed.scaleVisible
            : this.weatherStationsSharedState().scaleVisible,
        temporalMode: isWeatherStationsTemporalMode(parsed.temporalMode)
          ? parsed.temporalMode
          : this.weatherStationsSharedState().temporalMode,
        gracePeriodHours:
          typeof parsed.gracePeriodHours === 'number' &&
          Number.isFinite(parsed.gracePeriodHours)
            ? Math.max(0, Math.min(24, Math.round(parsed.gracePeriodHours)))
            : this.weatherStationsSharedState().gracePeriodHours,
        imageCount:
          typeof parsed.imageCount === 'number' && Number.isFinite(parsed.imageCount)
            ? this.normalizeWeatherStationsImageCount(parsed.imageCount)
            : this.weatherStationsSharedState().imageCount,
        selectedTilesetId:
          typeof parsed.selectedTilesetId === 'string' ? parsed.selectedTilesetId : null,
        showStationsWithoutData:
          typeof parsed.showStationsWithoutData === 'boolean'
            ? parsed.showStationsWithoutData
            : this.weatherStationsSharedState().showStationsWithoutData,
      });
  }

  private saveWeatherStationsSharedState(): void {
    this.storage.setJson(STORAGE_KEYS.WEATHER_STATIONS_SHARED_CONTROLS, this.weatherStationsSharedState());
  }

  private normalizeWeatherStationsImageCount(imageCount: number): number {
    const rounded = Math.max(1, Math.round(imageCount));
    const nextAllowed = WEATHER_STATIONS_IMAGE_COUNT_OPTIONS.find((option) => option >= rounded);
    return nextAllowed ?? WEATHER_STATIONS_IMAGE_COUNT_OPTIONS.at(-1)!;
  }
}
