import { Injectable, inject, computed, signal, effect } from '@angular/core';
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
  EcmwfLayerControls,
  EcmwfTileLayer,
  EcmwfTileLayerConfig,
} from '../../models';
import { LayersService } from './layers.service';
import {
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  DEFAULT_ACTIVE_LAYERS,
  DEFAULT_LAYER_CONTROLS,
} from '../../config/layers';
import { LayerConfigService } from './layer-config.service';

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
  private readonly ACTIVE_LAYERS_LOCAL_STORAGE_KEY = 'smn-active-layers-v3';

  private readonly layersService = inject(LayersService);
  private readonly layerConfigService = inject(LayerConfigService);

  private readonly controls = signal<Map<string, LayerControls>>(new Map());
  private readonly playbackIntervals = new Map<string, number>();

  constructor() {
    this.initializeControls();

    // Auto-save controls when they change
    effect(() => {
      this.saveControls();
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
      .filter((item): item is { layer: Layer; controls: LayerControls } => item !== null)
      .sort((a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0));
  });

  // ============================================================================
  // Public Getters
  // ============================================================================

  /**
   * Gets active layers filtered by their z-index group.
   */
  getActiveLayersForGroup(
    groupId: ActiveLayerGroupId,
  ): { layer: Layer; controls: LayerControls }[] {
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
          // Set timeIndex to latest if undefined and config exists
          if (controls.playback.timeIndex === undefined) {
            const availablePeriods = this.getAvailablePeriodsForLayer(layerId);
            if (availablePeriods && availablePeriods.length > 0) {
              controls.playback.timeIndex = availablePeriods.length - 1;
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
            case LayerCategory.ECMWF: {
              // Set default forecasts if none are selected and config is available
              const ecmwfControls = controls as EcmwfLayerControls;
              if (ecmwfControls.forecast.selectedForecastTimestamps.length === 0) {
                const ecmwfConfig = this.layerConfigService.getConfig(layerId);
                if (
                  ecmwfConfig &&
                  ecmwfConfig.type === LayerType.TILE &&
                  ecmwfConfig.category === LayerCategory.ECMWF
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
  toggleEcmwfForecast(layerId: string, forecastTs: string): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type !== LayerType.TILE || controls.category !== LayerCategory.ECMWF) return;
      const ecmwf = controls as EcmwfLayerControls;
      const current = ecmwf.forecast.selectedForecastTimestamps;
      const index = current.indexOf(forecastTs);
      if (index === -1) {
        ecmwf.forecast.selectedForecastTimestamps = [...current, forecastTs];
      } else {
        ecmwf.forecast.selectedForecastTimestamps = current.filter((ts) => ts !== forecastTs);
      }
    });

    // Update config availableTilesets based on new selection
    const updatedControls = this.getControls(layerId) as EcmwfLayerControls;
    this.layerConfigService.updateEcmwfSelectedForecasts(
      layerId,
      updatedControls.forecast.selectedForecastTimestamps,
    );

    // Deactivate if no forecasts selected
    if (updatedControls.forecast.selectedForecastTimestamps.length === 0) {
      this.deactivateLayer(layerId);
      return;
    }

    // Clamp timeIndex if the union shrank
    const newConfig = this.layerConfigService.getConfig(layerId) as EcmwfTileLayerConfig | undefined;
    if (
      newConfig &&
      updatedControls.playback.timeIndex !== undefined &&
      updatedControls.playback.timeIndex >= newConfig.availableTilesets.length
    ) {
      this.setTimeIndex(layerId, Math.max(0, newConfig.availableTilesets.length - 1));
    }
  }

  /**
   * Sets the opacity for a specific forecast run in an ECMWF layer.
   */
  setEcmwfForecastOpacity(layerId: string, forecastTs: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.ECMWF) {
        (controls as EcmwfLayerControls).forecast.forecastOpacity[forecastTs] = clampedOpacity;
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

    // Clear existing interval if playing
    if (this.isPlaying(layerId)) {
      const interval = this.playbackIntervals.get(layerId);
      if (interval) {
        clearInterval(interval);
        this.playbackIntervals.delete(layerId);
      }
    }

    const controls = this.getControls(layerId);
    if (controls.type !== LayerType.TILE) return;

    const availablePeriods = this.getAvailablePeriodsForLayer(layerId);
    if (!availablePeriods || availablePeriods.length === 0) return;

    const lastImagesCount = controls.playback.lastImagesCount;

    // Calculate playback range:
    // If available periods > last images count, start from (total - count) to show only recent images
    // Otherwise, start from 0 to show all available periods
    const maxTimeIndex = availablePeriods.length - 1;
    const minTimeIndex = Math.max(0, maxTimeIndex - lastImagesCount + 1);

    // Don't start playback if there's only 1 period in range
    if (maxTimeIndex - minTimeIndex < 1) return;

    // Reset to first frame of the cycle
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.timeIndex = minTimeIndex;
      }
    });

    const speed = controls.playback.speed;
    const interval = setInterval(() => {
      const controls = this.getControls(layerId);
      if (
        !controls ||
        controls.type !== LayerType.TILE ||
        !controls.playback ||
        !controls.playback.isPlaying ||
        controls.playback.timeIndex === undefined
      ) {
        return;
      }

      const current = controls.playback.timeIndex;
      const next = current >= maxTimeIndex ? minTimeIndex : current + 1;

      this.updateControls(layerId, (controls) => {
        if (controls.type === LayerType.TILE && controls.playback) {
          controls.playback.timeIndex = next;
        }
      });
    }, speed * 1000);

    this.playbackIntervals.set(layerId, interval);

    this.updateControls(layerId, (controls) => {
      switch (controls.type) {
        case LayerType.TILE:
          controls.playback.isPlaying = true;
          break;
        default:
          throw new Error(`Playback can only be started on tile layers`);
      }
    });
  }

  /**
   * Stops automatic playback for a tile layer.
   */
  stopPlayback(layerId: string): void {
    if (!this.isActive(layerId)) return;
    if (!this.isPlaying(layerId)) return;

    const interval = this.playbackIntervals.get(layerId);
    if (interval) {
      clearInterval(interval);
      this.playbackIntervals.delete(layerId);
    }

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
  private getAvailablePeriodsForLayer(layerId: string): string[] | undefined {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) throw new Error(`Layer '${layerId}' not found`);

    switch (layer.type) {
      case LayerType.TILE:
        switch (layer.category) {
          case LayerCategory.GOES_19:
          case LayerCategory.RADAR:
          case LayerCategory.ECMWF:
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
                // Clamp timeIndex to valid range
                const maxIndex = availablePeriods.length - 1;
                if (controls.playback.timeIndex > maxIndex) {
                  controls.playback.timeIndex = maxIndex;
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
          case LayerCategory.ECMWF:
            return {
              ...baseTileControls,
              category: LayerCategory.ECMWF,
              availablePeriods: (layer as EcmwfTileLayer).availablePeriods,
              forecast: {
                selectedForecastTimestamps: [],
                forecastOpacity: {},
              },
            } as EcmwfLayerControls;
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
    localStorage.setItem(this.ACTIVE_LAYERS_LOCAL_STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Loads layer controls from localStorage.
   */
  private loadControls(): LayerControls[] | undefined {
    try {
      const saved = localStorage.getItem(this.ACTIVE_LAYERS_LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  }
}
