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
import {
  buildEcmwfTpFrameOptions,
  computeWindowStart,
  getDefaultCursorIndex,
} from '../../utils/playback-window';
import {
  DEFAULT_SMN_STATIONS_MAX_PAST_HOURS,
  SMN_STATIONS_IMAGE_COUNT_OPTIONS,
  isSmnStationsTemporalMode,
  SmnStationsTemporalMode,
} from '../../config/layers/smn-stations/controls.constants';

interface PersistedSmnStationsSharedControlsState {
  opacity: number;
  zIndex: number | null;
  scaleVisible: boolean;
  temporalMode: SmnStationsTemporalMode;
  maxPastHours: number;
  imageCount: number;
  selectedTilesetId: string | null;
  // When false, the renderer filters out stations whose `hasData` is false
  // (i.e. their last observation falls outside the requested tolerance window).
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
}

type PersistedEcmwfTpLayerControls = Omit<EcmwfTpLayerControls, 'forecast'> & {
  forecast: PersistedEcmwfForecast;
};

type PersistedLayerControls =
  | GoesLayerControls
  | RadarLayerControls
  | WmsLayerControls
  | VectorLayerControls
  | PersistedEcmwfTpLayerControls;

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

  private readonly controls = signal<Map<string, LayerControls>>(new Map());
  private readonly smnStationsSharedState = signal<PersistedSmnStationsSharedControlsState>({
    opacity: 1,
    zIndex: null,
    scaleVisible: false,
    temporalMode: SmnStationsTemporalMode.LATEST,
    maxPastHours: DEFAULT_SMN_STATIONS_MAX_PAST_HOURS,
    imageCount: 6,
    selectedTilesetId: null,
    showStationsWithoutData: true,
  });

  /**
   * Transient buffer for ECMWF forecast indices loaded from localStorage. The
   * indices can't be translated to timestamps at `initializeControls()` time
   * because `availableForecasts` is only known after the config fetch. The
   * reconciliation effect drains this map on the first config emission per
   * layer.
   */
  private readonly pendingEcmwfIndices = new Map<
    string,
    { indices: number[]; opacityByIndex: Record<number, number> }
  >();

  constructor() {
    this.loadSmnStationsSharedState();
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
            this.updateControls(layer.id, (c) => {
              if (c.type !== LayerType.TILE || c.category !== LayerCategory.ECMWF_TP) return;
              const ec = c as EcmwfTpLayerControls;
              ec.forecast.selectedForecastTimestamps = translatedTs;
              ec.forecast.forecastOpacity = translatedOpacity;
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
          const currentSelected = ecmwfControls.forecast.selectedForecastTimestamps;
          const validSelected = currentSelected.filter((ts) => available.has(ts));

          // First-activation race: the user toggled the layer ON before its
          // config was fetched, so activateLayer couldn't seed the default
          // forecast. Apply the default now that the config arrived — without
          // this, the "no valid selection on a visible layer" branch below
          // would deactivate the layer (flickering it off after one click).
          // The "all selections became stale" case is distinguished by
          // currentSelected.length > 0.
          const isFirstActivationRace =
            currentSelected.length === 0 &&
            ecmwfControls.visible &&
            config.availableForecasts.length > 0;
          const effectiveSelected = isFirstActivationRace
            ? [config.availableForecasts[0]]
            : validSelected;

          const opacityEntries = Object.entries(ecmwfControls.forecast.forecastOpacity);
          const hasStaleOpacity = opacityEntries.some(([ts]) => !available.has(ts));
          const selectionMutated =
            effectiveSelected.length !== currentSelected.length ||
            effectiveSelected.some((ts, i) => ts !== currentSelected[i]);

          if (selectionMutated || hasStaleOpacity) {
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
            });
          }

          if (effectiveSelected.length === 0) {
            if (ecmwfControls.visible) {
              this.deactivateLayer(layer.id);
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
  }

  isSmnStationsLayer(layerId: string): boolean {
    const layer = this.layersService.getLayerById(layerId);
    return layer?.category === LayerCategory.SMN_STATIONS;
  }

  getSmnStationsSharedOpacity(): number {
    return this.smnStationsSharedState().opacity;
  }

  getSmnStationsSharedZIndex(): number | null {
    return this.smnStationsSharedState().zIndex;
  }

  isSmnStationsScaleVisible(): boolean {
    return this.smnStationsSharedState().scaleVisible;
  }

  getSmnStationsTemporalMode(): SmnStationsTemporalMode {
    return this.smnStationsSharedState().temporalMode;
  }

  getSmnStationsMaxPastHours(): number {
    return this.smnStationsSharedState().maxPastHours;
  }

  getSmnStationsSelectedTilesetId(): string | null {
    return this.smnStationsSharedState().selectedTilesetId;
  }

  getSmnStationsImageCount(): number {
    return this.smnStationsSharedState().imageCount;
  }

  captureSmnStationsSharedFromControls(controls: LayerControls): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      opacity: this.clampSmnStationsOpacity(controls.opacity),
      zIndex: Number.isFinite(controls.zIndex) ? Math.max(0, controls.zIndex) : null,
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsSharedOpacity(opacity: number): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      opacity: this.clampSmnStationsOpacity(opacity),
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsSharedZIndex(zIndex: number | null): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      zIndex: zIndex === null ? null : Math.max(0, Math.round(zIndex)),
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsScaleVisible(scaleVisible: boolean): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      scaleVisible,
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsTemporalMode(temporalMode: SmnStationsTemporalMode): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      temporalMode,
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsMaxPastHours(maxPastHours: number): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      maxPastHours: Math.max(0, Math.min(24, Math.round(maxPastHours))),
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsImageCount(imageCount: number): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      imageCount: this.normalizeSmnStationsImageCount(imageCount),
    }));
    this.saveSmnStationsSharedState();
  }

  setSmnStationsSelectedTilesetId(selectedTilesetId: string | null): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      selectedTilesetId,
    }));
    this.saveSmnStationsSharedState();
  }

  getSmnStationsShowStationsWithoutData(): boolean {
    return this.smnStationsSharedState().showStationsWithoutData;
  }

  setSmnStationsShowStationsWithoutData(showStationsWithoutData: boolean): void {
    this.smnStationsSharedState.update((state) => ({
      ...state,
      showStationsWithoutData,
    }));
    this.saveSmnStationsSharedState();
  }

  // Public readonly signal so component templates can react via computed/effect
  // without having to call the getter inside a tracking context.
  readonly smnStationsShowStationsWithoutData = computed(
    () => this.smnStationsSharedState().showStationsWithoutData,
  );

  // ============================================================================
  // Public Computed Signals
  // ============================================================================

  /**
   * Computed signal containing all currently active (visible) layers,
   * sorted by zIndex in descending order (highest on top).
   */
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

  /**
   * Gets active layers filtered by their z-index group.
   */
  getActiveLayersForGroup(groupId: ActiveLayerGroupId): ActiveLayerEntry[] {
    return this.activeLayers().filter(({ layer }) => layer.zIndexGroup === groupId);
  }

  /**
   * Gets the controls for a specific layer.
   * @throws Error if controls not found (all layers should have initialized controls)
   */
  getControls(layerId: string): LayerControls {
    const controls = this.controls().get(layerId);
    if (!controls) throw new Error(`Controls for layer '${layerId}' not found`);
    return controls;
  }

  /**
   * Calculates the absolute z-index for a layer based on its group and relative position.
   * @throws Error if layer not found
   */
  getAbsoluteZIndex(layerId: string, controls: LayerControls): number {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) throw new Error(`Layer '${layerId}' not found`);
    const baseOffset = ACTIVE_LAYER_GROUP_DEFINITIONS[layer.zIndexGroup].zIndexRange.min;
    return baseOffset + controls.zIndex;
  }

  /**
   * Checks if a layer is currently playing back.
   */
  isPlaying(layerId: string): boolean {
    const controls = this.getControls(layerId);
    if (controls.type !== LayerType.TILE) return false;
    return controls.playback?.isPlaying ?? false;
  }

  /**
   * Gets the selected elevations for a radar layer.
   */
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

  /**
   * Toggles a layer's visibility on/off.
   */
  toggleLayer(layerId: string): void {
    if (this.isActive(layerId)) {
      this.deactivateLayer(layerId);
    } else {
      this.activateLayer(layerId);
    }
  }

  /**
   * Activates (makes visible) a layer and assigns it a z-index.
   * If the layer has config and timeIndex is undefined, sets it to the latest period.
   * For radar layers, sets default elevations if none are selected.
   */
  activateLayer(layerId: string): void {
    if (this.isActive(layerId)) return;

    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return;

    this.updateControls(layerId, (controls) => {
      controls.visible = true;
      controls.zIndex = this.getNextZIndex(layer.zIndexGroup);

      // Initialize layer-specific defaults
      switch (controls.type) {
        case LayerType.TILE:
          // Set default cursor if timeIndex is undefined and config exists.
          // Forecast layers start at the first frame; historical at the last.
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

          // Handle category-specific initialization
          switch (controls.category) {
            case LayerCategory.RADAR:
              // Set default elevations if none are selected
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
              // No special initialization needed for GOES layers
              break;
            case LayerCategory.ECMWF_TP: {
              // Set default forecasts if none are selected and config is available
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
          }
          break;
        case LayerType.VECTOR:
          // No special initialization needed for vector layers
          break;
        case LayerType.WMS:
          // No special initialization needed for WMS layers
          break;
      }
    });
  }

  /**
   * Deactivates (hides) a layer and stops playback if running.
   */
  deactivateLayer(layerId: string): void {
    if (!this.isActive(layerId)) return;

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback.isPlaying) {
        this.stopPlayback(layerId);
      }

      controls.visible = false;
    });
  }

  /**
   * Deactivates all active layers and activates only the specified layer.
   */
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

  /**
   * Sets the opacity for a layer (0-1).
   */
  setOpacity(layerId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      controls.opacity = clampedOpacity;
    });

    if (this.isSmnStationsLayer(layerId)) {
      this.setSmnStationsSharedOpacity(clampedOpacity);
    }
  }

  /**
   * Sets the z-index for a layer.
   */
  setZIndex(layerId: string, zIndex: number): void {
    const normalizedZIndex = Math.max(0, Math.round(zIndex));

    this.updateControls(layerId, (controls) => {
      controls.zIndex = normalizedZIndex;
    });

    if (this.isSmnStationsLayer(layerId)) {
      this.setSmnStationsSharedZIndex(normalizedZIndex);
    }
  }

  /**
   * Sets the active time index for tile layers with time series data.
   */
  setTimeIndex(layerId: string, timeIndex: number): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.timeIndex = timeIndex;
      }
    });
  }

  /**
   * Toggles an elevation for radar layers (adds if not present, removes if present).
   * If all elevations are removed, the layer is automatically deactivated.
   */
  toggleElevation(layerId: string, elevationId: string): void {
    this.updateControls(layerId, (controls) => {
      switch (controls.type) {
        case LayerType.TILE:
          switch (controls.category) {
            case LayerCategory.RADAR:
              const currentSelected = controls.elevation.selectedElevationIds;
              const index = currentSelected.indexOf(elevationId);

              if (index === -1) {
                // Add elevation if not present
                controls.elevation.selectedElevationIds = [...currentSelected, elevationId];
              } else {
                // Remove elevation if present
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

    // Deactivate the layer if no elevations are selected
    const updatedControls = this.getControls(layerId);
    if (
      updatedControls.type === LayerType.TILE &&
      updatedControls.category === LayerCategory.RADAR &&
      updatedControls.elevation.selectedElevationIds.length === 0
    ) {
      this.deactivateLayer(layerId);
    }
  }

  /**
   * Sets the selected elevations for radar layers.
   * If no elevations are provided, the layer is automatically deactivated.
   */
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

    // Deactivate the layer if no elevations are selected
    if (elevationIds.length === 0) {
      this.deactivateLayer(layerId);
    }
  }

  /**
   * Sets the opacity for a specific elevation in a radar layer.
   */
  setElevationOpacity(layerId: string, elevationId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.RADAR) {
        controls.elevation.elevationOpacity[elevationId] = clampedOpacity;
      }
    });
  }

  /**
   * Sets the number of most recent images to display in playback mode.
   * Automatically adjusts timeIndex to the start of the selected range.
   */
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

    // Calculate and set the optimal timeIndex for the new range
    if (controls && controls.type === LayerType.TILE) {
      const newTimeIndex = this.layerConfigService.calculateTimeIndexForRange(layerId, count);
      if (newTimeIndex !== undefined) {
        this.setTimeIndex(layerId, newTimeIndex);
      }
    }

    // Handle playback state
    if (count === 1) {
      // Stop playback if it was playing (can't play with 1 image)
      if (wasPlaying) {
        this.stopPlayback(layerId);
      }
    } else {
      // If playing, stop and restart to apply new range
      if (wasPlaying) {
        this.stopPlayback(layerId);
        // Use setTimeout to ensure control update completes
        setTimeout(() => {
          this.startPlayback(layerId);
        }, 0);
      }
    }
  }

  /**
   * Toggles a forecast run on/off for ECMWF layers (adds if not present, removes if present).
   * If all forecasts are removed, the layer is automatically deactivated.
   */
  toggleEcmwfTpForecast(layerId: string, forecastTs: string): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF_TP) return;
      const ecmwf = controls as EcmwfTpLayerControls;
      const current = ecmwf.forecast.selectedForecastTimestamps;
      const index = current.indexOf(forecastTs);
      if (index === -1) {
        ecmwf.forecast.selectedForecastTimestamps = [...current, forecastTs];
      } else {
        ecmwf.forecast.selectedForecastTimestamps = current.filter((ts) => ts !== forecastTs);
      }
    });

    // Update config availableTilesets based on new selection. The returned
    // config reflects the new union synchronously; calling getConfig() right
    // after would still see the previous availableTilesets because the signal
    // write is deferred via queueMicrotask.
    const updatedControls = this.getControls(layerId) as EcmwfTpLayerControls;
    const newConfig = this.layerConfigService.updateEcmwfTpSelectedForecasts(
      layerId,
      updatedControls.forecast.selectedForecastTimestamps,
    );

    // Deactivate if no forecasts selected
    if (updatedControls.forecast.selectedForecastTimestamps.length === 0) {
      this.deactivateLayer(layerId);
      return;
    }

    if (!newConfig) return;
    const newUnionCount = newConfig.availableTilesets.length;
    const layer = this.layersService.getLayerById(layerId);

    // Clamp timeIndex if the union shrank — reset to the layer's default cursor.
    if (
      updatedControls.playback.timeIndex !== undefined &&
      updatedControls.playback.timeIndex >= newUnionCount
    ) {
      const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
      this.setTimeIndex(layerId, getDefaultCursorIndex(newUnionCount, isForecast));
    }

    // Reconcile imageCount with the new union size: if the current value is
    // no longer in the dropdown's options (e.g. it was the per-forecast cap of
    // 47 and the union just grew to 51, or vice versa), snap it to the new
    // max so the selector stays valid without a manual user re-pick.
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

  /**
   * Sets the opacity for a specific forecast run in an ECMWF layer.
   */
  setEcmwfTpForecastOpacity(layerId: string, forecastTs: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.ECMWF_TP) {
        (controls as EcmwfTpLayerControls).forecast.forecastOpacity[forecastTs] = clampedOpacity;
      }
    });
  }

  /**
   * Reorders layers within a group after drag and drop.
   * Receives the complete layer order for the group and recalculates z-indices.
   */
  setActiveGroupLayersOrder(
    activeLayerGroupId: ActiveLayerGroupId,
    orderedLayerIds: string[],
  ): void {
    // First deactivate layers in the group not specified in the new order
    this.getActiveLayersForGroup(activeLayerGroupId).forEach(({ layer }) => {
      if (!orderedLayerIds.includes(layer.id)) {
        this.deactivateLayer(layer.id);
      }
    });

    // Filter to only active layers and assign new z-indices according to order
    const filteredIds = orderedLayerIds.filter((id) => this.isActive(id));
    const maxIndex = filteredIds.length - 1;

    filteredIds.forEach((layerId: string, uiIndex: number) => {
      this.updateControls(layerId, (controls) => {
        if (controls.visible) {
          controls.zIndex = maxIndex - uiIndex;
        }
      });
    });

    const activeSmnLayerId = filteredIds.find((layerId) => this.isSmnStationsLayer(layerId));

    if (activeSmnLayerId) {
      const controls = this.getControls(activeSmnLayerId);
      if (controls.visible) {
        this.setSmnStationsSharedZIndex(controls.zIndex ?? 0);
      }
    }
  }

  // ============================================================================
  // Public Actions - Playback
  // ============================================================================

  /**
   * Sets the playback speed for tile layers (0.4-10 seconds per frame).
   */
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

  /**
   * Toggles playback on/off for tile layers.
   */
  togglePlayback(layerId: string): void {
    if (this.isPlaying(layerId)) {
      this.stopPlayback(layerId);
    } else {
      this.startPlayback(layerId);
    }
  }

  /**
   * Starts automatic playback for a tile layer, cycling through available time periods.
   */
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

  /**
   * Stops automatic playback for a tile layer.
   */
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

  /**
   * Checks if a layer is currently active (visible).
   */
  private isActive(layerId: string): boolean {
    const controls = this.getControls(layerId);
    return controls?.visible ?? false;
  }

  /**
   * Gets the available time periods for a layer based on its type and configuration.
   * Returns undefined if config not yet loaded.
   * @throws Error if layer not found or unsupported layer type
   */
  private getAvailablePeriodsForLayer(layerId: string): TilesetEntry[] | undefined {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) throw new Error(`Layer '${layerId}' not found`);

    switch (layer.type) {
      case LayerType.TILE:
        switch (layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
          case LayerCategory.ECMWF_TP:
            return this.layerConfigService.getAvailableTilesets(layerId);
          default:
            throw new Error(`Unsupported tile layer category for playback`);
        }
      default:
        throw new Error(`Only tile layers have available periods for playback`);
    }
  }

  /**
   * Gets the next available z-index for a layer in its group.
   */
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

  /**
   * Updates a layer's controls using an update function.
   * Creates a new immutable copy of the controls map to trigger reactive updates.
   */
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

  /**
   * Initializes layer controls from saved state or defaults.
   */
  private initializeControls(): void {
    const savedState = this.loadControls();

    const stateMap = new Map(savedState ? savedState.map((s) => [s.id, s]) : []);
    const controlsMap = new Map<string, LayerControls>();

    // Find max zIndex from saved visible layers to avoid conflicts
    const maxSavedZIndex = savedState
      ? Math.max(-1, ...savedState.filter((c) => c.visible).map((c) => c.zIndex ?? 0))
      : -1;
    let initialZIndex = maxSavedZIndex + 1;

    for (const layer of this.layersService.getAllLayers()) {
      let controls: LayerControls;
      const savedControls = stateMap.get(layer.id);

      if (savedControls) {
        // Restore saved state, but ensure isPlaying is false and zIndex is defined.
        // For ECMWF, also buffer the persisted forecast indices for later
        // hydration in the reconciliation effect (config not yet available).
        controls = {
          ...this.fromPersistedControls(savedControls),
          zIndex: savedControls.zIndex ?? 0,
        };
        if (controls.type === LayerType.TILE) {
          controls.playback = {
            ...controls.playback,
            isPlaying: false,
          };

          // Validate timeIndex against current config if available (config might not be loaded yet)
          if (controls.playback.timeIndex !== undefined) {
            try {
              const availablePeriods = this.getAvailablePeriodsForLayer(layer.id);
              if (availablePeriods && availablePeriods.length > 0) {
                // Clamp timeIndex to valid range. Out-of-range values reset to
                // the layer's default cursor (first frame for forecasts, last otherwise).
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
              // Config not loaded yet, will be validated when config arrives
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

  /**
   * Creates default base controls for a layer.
   */
  private createDefaultBaseControls(layer: Layer): BaseLayerControls {
    return {
      id: layer.id,
      visible: false,
      opacity: DEFAULT_LAYER_CONTROLS.opacity,
      zIndex: 0,
    };
  }

  /**
   * Creates appropriate controls for a layer based on its type and category.
   */
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
            // Find elevation(s) marked as default
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
              },
            } as EcmwfTpLayerControls;
          default:
            throw new Error(`Layer category does not have a defined controls template`);
        }
      default:
        throw new Error(`Unsupported layer type`);
    }
  }

  /**
   * Saves active layer controls to localStorage. ECMWF forecast selection
   * (timestamps at runtime) is translated to indices into `availableForecasts`
   * so that "the latest run" stays "the latest run" across sessions, even
   * when the underlying timestamps have rolled forward.
   */
  private saveControls(): void {
    const state = this.activeLayers().map(({ controls }) => this.toPersistedControls(controls));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LAYERS, JSON.stringify(state));
  }

  /**
   * Converts runtime LayerControls to its persisted shape. Only ECMWF needs
   * translation; other categories serialize as-is.
   */
  private toPersistedControls(controls: LayerControls): PersistedLayerControls {
    if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF_TP) {
      return controls;
    }
    const ecmwf = controls as EcmwfTpLayerControls;
    const config = this.layerConfigService.getConfig(ecmwf.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    // Defensive: if config isn't available (shouldn't happen for an active
    // layer being persisted), drop the selection rather than write stale data.
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
    return {
      ...ecmwf,
      forecast: { selectedForecastIndices, forecastOpacityByIndex },
    };
  }

  /**
   * Converts persisted LayerControls back to its runtime shape. For ECMWF,
   * stashes the persisted forecast indices into `pendingEcmwfIndices` and
   * returns controls with empty runtime forecast state — the reconciliation
   * effect translates indices to timestamps once the config arrives.
   */
  private fromPersistedControls(persisted: PersistedLayerControls): LayerControls {
    if (persisted.type !== LayerType.TILE || persisted.category !== LayerCategory.ECMWF_TP) {
      return persisted as LayerControls;
    }
    const ecmwfPersisted = persisted as PersistedEcmwfTpLayerControls;
    this.pendingEcmwfIndices.set(ecmwfPersisted.id, {
      indices: [...(ecmwfPersisted.forecast.selectedForecastIndices ?? [])],
      opacityByIndex: { ...(ecmwfPersisted.forecast.forecastOpacityByIndex ?? {}) },
    });
    return {
      ...ecmwfPersisted,
      forecast: {
        selectedForecastTimestamps: [],
        forecastOpacity: {},
      },
    } as EcmwfTpLayerControls;
  }

  /**
   * Loads layer controls from localStorage. The persisted shape for ECMWF
   * layers carries forecast selection as indices rather than timestamps —
   * `initializeControls` is responsible for buffering those into
   * `pendingEcmwfIndices` and producing a valid runtime `LayerControls`.
   */
  private loadControls(): PersistedLayerControls[] | undefined {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_LAYERS);
      return saved ? (JSON.parse(saved) as PersistedLayerControls[]) : undefined;
    } catch {
      return undefined;
    }
  }

  private clampSmnStationsOpacity(opacity: number): number {
    return Math.max(0, Math.min(1, opacity));
  }

  private loadSmnStationsSharedState(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SMN_STATIONS_SHARED_CONTROLS);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedSmnStationsSharedControlsState>;

      this.smnStationsSharedState.set({
        opacity:
          typeof parsed.opacity === 'number'
            ? this.clampSmnStationsOpacity(parsed.opacity)
            : this.smnStationsSharedState().opacity,
        zIndex:
          typeof parsed.zIndex === 'number' && Number.isFinite(parsed.zIndex)
            ? Math.max(0, Math.round(parsed.zIndex))
            : null,
        scaleVisible:
          typeof parsed.scaleVisible === 'boolean'
            ? parsed.scaleVisible
            : this.smnStationsSharedState().scaleVisible,
        temporalMode: isSmnStationsTemporalMode(parsed.temporalMode)
          ? parsed.temporalMode
          : this.smnStationsSharedState().temporalMode,
        maxPastHours:
          typeof parsed.maxPastHours === 'number' && Number.isFinite(parsed.maxPastHours)
            ? Math.max(0, Math.min(24, Math.round(parsed.maxPastHours)))
            : this.smnStationsSharedState().maxPastHours,
        imageCount:
          typeof parsed.imageCount === 'number' && Number.isFinite(parsed.imageCount)
            ? this.normalizeSmnStationsImageCount(parsed.imageCount)
            : this.smnStationsSharedState().imageCount,
        selectedTilesetId:
          typeof parsed.selectedTilesetId === 'string' ? parsed.selectedTilesetId : null,
        showStationsWithoutData:
          typeof parsed.showStationsWithoutData === 'boolean'
            ? parsed.showStationsWithoutData
            : this.smnStationsSharedState().showStationsWithoutData,
      });
    } catch {
      // Ignore malformed persisted state.
    }
  }

  private saveSmnStationsSharedState(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEYS.SMN_STATIONS_SHARED_CONTROLS,
        JSON.stringify(this.smnStationsSharedState()),
      );
    } catch {
      // Ignore storage failures.
    }
  }

  private normalizeSmnStationsImageCount(imageCount: number): number {
    const rounded = Math.max(1, Math.round(imageCount));
    const nextAllowed = SMN_STATIONS_IMAGE_COUNT_OPTIONS.find((option) => option >= rounded);
    return nextAllowed ?? SMN_STATIONS_IMAGE_COUNT_OPTIONS.at(-1)!;
  }
}
