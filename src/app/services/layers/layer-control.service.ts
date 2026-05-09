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
  WrfLayerControls,
  WrfTileLayer,
  WrfTileLayerConfig,
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
import { computeWindowStart, getDefaultCursorIndex } from '../../utils/playback-window';

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

  constructor() {
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
            (config.category === LayerCategory.ECMWF_TP ||
              config.category === LayerCategory.WRF) &&
            config.availableForecasts.length > 0
          ) {
            const firstForecast = config.availableForecasts[0];
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
  }

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
                  }
                }
              }
              break;
            }
            case LayerCategory.WRF: {
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
  setLastImagesCount(layerId: string, count: number): void {
    const wasPlaying = this.isPlaying(layerId);
    const controls = this.getControls(layerId);

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE) {
        if (!controls.playback) {
          controls.playback = {
            isPlaying: false,
            speed: 1.0,
            timeIndex: 0,
            lastImagesCount: count,
          };
        } else {
          controls.playback.lastImagesCount = count;
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

    // Update config availableTilesets based on new selection
    const updatedControls = this.getControls(layerId) as EcmwfTpLayerControls;
    this.layerConfigService.updateEcmwfTpSelectedForecasts(
      layerId,
      updatedControls.forecast.selectedForecastTimestamps,
    );

    // Deactivate if no forecasts selected
    if (updatedControls.forecast.selectedForecastTimestamps.length === 0) {
      this.deactivateLayer(layerId);
      return;
    }

    // Clamp timeIndex if the union shrank — reset to the layer's default cursor.
    const newConfig = this.layerConfigService.getConfig(layerId) as
      | EcmwfTpTileLayerConfig
      | undefined;
    if (
      newConfig &&
      updatedControls.playback.timeIndex !== undefined &&
      updatedControls.playback.timeIndex >= newConfig.availableTilesets.length
    ) {
      const layer = this.layersService.getLayerById(layerId);
      const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
      this.setTimeIndex(
        layerId,
        getDefaultCursorIndex(newConfig.availableTilesets.length, isForecast),
      );
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
   * Activa/desactiva un init_tag (corrida) en una capa WRF.
   * Si todas las corridas quedan deseleccionadas la capa se desactiva.
   */
  toggleWrfForecast(layerId: string, initTag: string): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.WRF) return;
      const wrf = controls as WrfLayerControls;
      const current = wrf.forecast.selectedForecastTimestamps;
      const index = current.indexOf(initTag);
      if (index === -1) {
        wrf.forecast.selectedForecastTimestamps = [...current, initTag];
      } else {
        wrf.forecast.selectedForecastTimestamps = current.filter((ts) => ts !== initTag);
      }
    });

    const updatedControls = this.getControls(layerId) as WrfLayerControls;
    this.layerConfigService.updateWrfSelectedForecasts(
      layerId,
      updatedControls.forecast.selectedForecastTimestamps,
    );

    if (updatedControls.forecast.selectedForecastTimestamps.length === 0) {
      this.deactivateLayer(layerId);
      return;
    }

    const newConfig = this.layerConfigService.getConfig(layerId) as
      | WrfTileLayerConfig
      | undefined;
    if (
      newConfig &&
      updatedControls.playback.timeIndex !== undefined &&
      updatedControls.playback.timeIndex >= newConfig.availableTilesets.length
    ) {
      const layer = this.layersService.getLayerById(layerId);
      const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
      this.setTimeIndex(
        layerId,
        getDefaultCursorIndex(newConfig.availableTilesets.length, isForecast),
      );
    }
  }

  /**
   * Opacidad por corrida (init_tag) en una capa WRF.
   */
  setWrfForecastOpacity(layerId: string, initTag: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.WRF) {
        (controls as WrfLayerControls).forecast.forecastOpacity[initTag] = clampedOpacity;
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

    const lastImagesCount = controls.playback.lastImagesCount;
    const layer = this.layersService.getLayerById(layerId);
    const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
    const minTimeIndex = computeWindowStart(availablePeriods.length, lastImagesCount, isForecast);
    const maxTimeIndex = Math.min(minTimeIndex + lastImagesCount - 1, availablePeriods.length - 1);
    const frameCount = maxTimeIndex - minTimeIndex + 1;

    if (frameCount < 2) return;

    const speed = controls.playback.speed;

    this.engineService.register(layerId, frameCount, speed);

    this.updateControls(layerId, (c) => {
      if (c.type === LayerType.TILE && c.playback) {
        c.playback.isPlaying = true;
        c.playback.timeIndex = minTimeIndex;
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
          case LayerCategory.WRF:
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
        // Restore saved state, but ensure isPlaying is false and zIndex is defined
        controls = { ...savedControls, zIndex: savedControls.zIndex ?? 0 };
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
      case LayerType.TILE:
        const baseTileControls: TileLayerControls = {
          ...baseControls,
          type: LayerType.TILE,
          playback: {
            isPlaying: false,
            timeIndex: undefined, // Will be set to latest when config loads
            speed: DEFAULT_LAYER_CONTROLS.playbackSpeed,
            lastImagesCount: DEFAULT_LAYER_CONTROLS.lastImagesCount,
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
          case LayerCategory.WRF:
            return {
              ...baseTileControls,
              category: LayerCategory.WRF,
              availablePeriods: (layer as WrfTileLayer).availablePeriods,
              forecast: {
                selectedForecastTimestamps: [],
                forecastOpacity: {},
              },
            } as WrfLayerControls;
          default:
            throw new Error(`Layer category does not have a defined controls template`);
        }
      default:
        throw new Error(`Unsupported layer type`);
    }
  }

  /**
   * Saves active layer controls to localStorage.
   */
  private saveControls(): void {
    const state = this.activeLayers().map(({ controls }) => controls);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_LAYERS, JSON.stringify(state));
  }

  /**
   * Loads layer controls from localStorage.
   */
  private loadControls(): LayerControls[] | undefined {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_LAYERS);
      return saved ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  }
}
