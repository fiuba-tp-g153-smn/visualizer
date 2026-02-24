import { Injectable, inject, computed, signal, effect } from '@angular/core';
import {
  Layer,
  LayerType,
  LayerCategory,
  ActiveLayerGroup,
  LayerControls,
  GoesLayerControls,
  RadarLayerControls,
  WmsLayerControls,
} from '../../models';
import { LayersService } from './layers.service';
import { ACTIVE_LAYER_GROUP_DEFINITIONS } from '../../config/layers/active-groups.config';
import { DEFAULT_ACTIVE_LAYERS } from '../../config/layers/default';

@Injectable({
  providedIn: 'root',
})
export class LayerControlService {
  private readonly STORAGE_KEY = 'smn-active-layers-v2';
  private readonly layersService = inject(LayersService);
  private readonly _controls = signal<Map<string, LayerControls>>(new Map());
  private readonly playIntervals = new Map<string, any>();

  public readonly activeLayers = computed(() => {
    const allLayers = this.layersService.getAllLayers();
    return allLayers
      .map((layer) => {
        const controls = this._controls().get(layer.id);
        return controls?.visible ? { layer, controls } : null;
      })
      .filter((item): item is { layer: Layer; controls: LayerControls } => item !== null)
      .sort((a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0));
  });

  constructor() {
    this._initializeControls();

    effect(() => {
      const controls = Array.from(this._controls().values());
      this._saveState(controls);
    });
  }

  getActiveLayersForGroup(groupId: ActiveLayerGroup): { layer: Layer; controls: LayerControls }[] {
    return this.activeLayers().filter(({ layer }) => layer.zIndexGroup === groupId);
  }

  getLayerById(layerId: string): Layer | undefined {
    return this.layersService.getLayerById(layerId);
  }

  getControls(layerId: string): LayerControls | undefined {
    return this._controls().get(layerId);
  }

  activateLayer(layerId: string): void {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return;

    this._updateControls(layerId, (controls) => {
      if (!controls.visible) {
        controls.visible = true;
        controls.zIndex = this._getNextZIndex(layer.zIndexGroup);
        controls.opacity = controls.opacity ?? 100;

        if (layer.type === LayerType.TILE && controls.type === LayerType.TILE && !controls.playback) {
          const availablePeriods = layer.availablePeriods ?? [1];

          let defaultCount: number;
          if (layer.id.startsWith('glm-')) {
            defaultCount = 1;
          } else {
            defaultCount = availablePeriods.length > 1 ? availablePeriods[1] : availablePeriods[0];
          }

          controls.playback = {
            isPlaying: false,
            speed: 1,
            timeIndex: 0,
            lastImagesCount: defaultCount,
          };
        }
      }
    });
  }

  deactivateLayer(layerId: string): void {
    this._updateControls(layerId, (controls) => {
      controls.visible = false;
    });
  }

  replaceAllWithLayer(layerId: string): void {
    this._controls.update((controlsMap) => {
      const newMap = new Map(controlsMap);
      newMap.forEach((controls) => {
        controls.visible = false;
      });
      return newMap;
    });
    this.activateLayer(layerId);
  }

  toggleLayer(layerId: string): void {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return;

    this._updateControls(layerId, (controls) => {
      controls.visible = !controls.visible;
      if (controls.visible) {
        controls.zIndex = controls.zIndex ?? this._getNextZIndex(layer.zIndexGroup);
        controls.opacity = controls.opacity ?? 100;
      }
    });
  }

  getAbsoluteZIndex(layer: Layer, controls: LayerControls): number {
    if (controls.zIndex === undefined) return 0;
    const baseOffset = ACTIVE_LAYER_GROUP_DEFINITIONS[layer.zIndexGroup].zIndexRange.min;
    return baseOffset + controls.zIndex;
  }

  setOpacity(layerId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    this._updateControls(layerId, (controls) => {
      controls.opacity = clampedOpacity;
    });
  }

  setTimeIndex(layerId: string, timeIndex: number): void {
    this._updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.timeIndex = timeIndex;
      }
    });
  }

  setElevationIndex(layerId: string, elevationIndex: number): void {
    this._updateControls(layerId, (controls) => {
      if ('elevation' in controls && controls.elevation) {
        controls.elevation.elevationIndex = elevationIndex;
      }
    });
  }

  isPlaying(layerId: string): boolean {
    const controls = this.getControls(layerId);
    if (!controls || controls.type !== LayerType.TILE) return false;
    return controls.playback?.isPlaying ?? false;
  }

  getPlaySpeed(layerId: string): number {
    const controls = this.getControls(layerId);
    if (!controls || controls.type !== LayerType.TILE) return 1;
    return controls.playback?.speed ?? 1;
  }

  setPlaySpeed(layerId: string, speed: number): void {
    const clampedSpeed = Math.max(0.4, Math.min(10, speed));
    const wasPlaying = this.isPlaying(layerId);

    this._updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE) {
        if (!controls.playback) {
          controls.playback = { isPlaying: false, speed: 1, timeIndex: 0, lastImagesCount: 1 };
        }
        controls.playback.speed = clampedSpeed;
      }
    });

    if (wasPlaying) {
      const controls = this.getControls(layerId);
      if (!controls || controls.type !== LayerType.TILE || !controls.playback) return;

      const maxTimeIndex = controls.playback.maxTimeIndex ?? 0;
      const lastImagesCount = controls.playback.lastImagesCount ?? 1;
      const minTimeIndex = Math.max(0, maxTimeIndex - lastImagesCount + 1);
      this.stopPlayback(layerId);
      this.startPlayback(layerId, maxTimeIndex, minTimeIndex);
    }
  }

  togglePlayback(layerId: string, maxTimeIndex: number, minTimeIndex: number = 0): void {
    if (this.isPlaying(layerId)) {
      this.stopPlayback(layerId);
    } else {
      this.startPlayback(layerId, maxTimeIndex, minTimeIndex);
    }
  }

  startPlayback(layerId: string, maxTimeIndex: number, minTimeIndex: number = 0): void {
    this.stopPlayback(layerId);

    this._updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE) {
        const currentSpeed = controls.playback?.speed || 1;
        const currentCount = controls.playback?.lastImagesCount ?? 1;
        const currentTime = controls.playback?.timeIndex ?? maxTimeIndex;
        
        controls.playback = {
          isPlaying: true,
          speed: currentSpeed,
          maxTimeIndex,
          minTimeIndex,
          lastImagesCount: currentCount,
          timeIndex: Math.max(minTimeIndex, Math.min(currentTime, maxTimeIndex)),
        };
      }
    });

    const speed = this.getPlaySpeed(layerId);
    const interval = setInterval(() => {
      const controls = this.getControls(layerId);
      if (!controls?.visible || controls.type !== LayerType.TILE) {
        this.stopPlayback(layerId);
        return;
      }

      if (!controls.playback?.isPlaying) {
        this.stopPlayback(layerId);
        return;
      }

      const max = controls.playback.maxTimeIndex ?? maxTimeIndex;
      const min = controls.playback.minTimeIndex ?? minTimeIndex;
      const current = controls.playback.timeIndex ?? min;

      this.setTimeIndex(layerId, current >= max ? min : current + 1);
    }, speed * 1000);

    this.playIntervals.set(layerId, interval);
  }

  stopPlayback(layerId: string): void {
    this._updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.isPlaying = false;
        controls.playback.maxTimeIndex = undefined;
      }
    });

    const interval = this.playIntervals.get(layerId);
    if (interval) {
      clearInterval(interval);
      this.playIntervals.delete(layerId);
    }
  }

  stopAllPlayback(): void {
    this.playIntervals.forEach((interval, layerId) => {
      clearInterval(interval);
      this._updateControls(layerId, (controls) => {
        if (controls.type === LayerType.TILE && controls.playback) {
          controls.playback.isPlaying = false;
          controls.playback.maxTimeIndex = undefined;
        }
      });
    });
    this.playIntervals.clear();
  }

  getLastImagesCount(layerId: string): number {
    const controls = this.getControls(layerId);
    if (!controls || controls.type !== LayerType.TILE) return 1;
    return controls.playback?.lastImagesCount ?? 1;
  }

  setLastImagesCount(layerId: string, count: number): void {
    this._updateControls(layerId, (controls) => {
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
  }

  moveLayerUp(layerId: string): void {
    const controls = this.getControls(layerId);
    const layer = this.layersService.getLayerById(layerId);
    if (!controls?.visible || !layer || controls.zIndex === undefined) return;

    const visibleLayersInGroup = this.activeLayers()
      .filter((item) => item.layer.zIndexGroup === layer.zIndexGroup);
    const currentIndex = visibleLayersInGroup.findIndex((item) => item.layer.id === layerId);

    if (currentIndex > 0) {
      const prevLayer = visibleLayersInGroup[currentIndex - 1];
      this._swapZIndex(layer.id, prevLayer.layer.id);
    }
  }

  moveLayerDown(layerId: string): void {
    const controls = this.getControls(layerId);
    const layer = this.layersService.getLayerById(layerId);
    if (!controls?.visible || !layer || controls.zIndex === undefined) return;

    const visibleLayersInGroup = this.activeLayers()
      .filter((item) => item.layer.zIndexGroup === layer.zIndexGroup);
    const currentIndex = visibleLayersInGroup.findIndex((item) => item.layer.id === layerId);

    if (currentIndex < visibleLayersInGroup.length - 1) {
      const nextLayer = visibleLayersInGroup[currentIndex + 1];
      this._swapZIndex(layer.id, nextLayer.layer.id);
    }
  }

  setLayerOrder(orderedLayerIds: string[]): void {
    const maxIndex = orderedLayerIds.length - 1;
    orderedLayerIds.forEach((layerId: string, uiIndex: number) => {
      this._updateControls(layerId, (controls) => {
        if (controls.visible) {
          controls.zIndex = maxIndex - uiIndex;
        }
      });
    });
  }

  private _swapZIndex(layerId1: string, layerId2: string): void {
    const controls1 = this.getControls(layerId1);
    const controls2 = this.getControls(layerId2);

    if (!controls1?.zIndex || !controls2?.zIndex) return;

    const tempZIndex = controls1.zIndex;
    this._updateControls(layerId1, (controls) => {
      controls.zIndex = controls2!.zIndex;
    });
    this._updateControls(layerId2, (controls) => {
      controls.zIndex = tempZIndex;
    });
  }

  private _initializeControls(): void {
    const savedState = this._loadState();
    if (savedState) {
      console.debug('Visualizer: Loaded layer state from storage', savedState.length, 'controls');
    } else {
      console.debug('Visualizer: No saved state, applying defaults');
    }

    const stateMap = savedState ? new Map(savedState.map((s) => [s.id, s])) : null;
    const controlsMap = new Map<string, LayerControls>();
    let defaultZIndexCounter = 0;

    for (const layerDef of this.layersService.getAllLayers()) {
      let controls: LayerControls;

      if (stateMap) {
        const savedControls = stateMap.get(layerDef.id);
        if (savedControls) {
          // Restore saved state, but ensure isPlaying is false
          controls = { ...savedControls };
          if (controls.type === LayerType.TILE && controls.playback) {
            controls.playback = {
              ...controls.playback,
              isPlaying: false,
            };
          }
        } else {
          // No saved state for this layer, create default inactive controls
          controls = this._createControlsForLayer(layerDef);
        }
      } else if (DEFAULT_ACTIVE_LAYERS.includes(layerDef.id)) {
        // Apply default active layers
        controls = this._createControlsForLayer(layerDef);
        controls.visible = true;
        controls.zIndex = defaultZIndexCounter++;
        controls.opacity = 100;
      } else {
        // Create default inactive controls
        controls = this._createControlsForLayer(layerDef);
      }

      controlsMap.set(layerDef.id, controls);
    }

    this._controls.set(controlsMap);
  }

  private _createControlsForLayer(layer: Layer): LayerControls {
    if (layer.type === LayerType.WMS) {
      return {
        id: layer.id,
        type: LayerType.WMS,
        visible: false,
        opacity: 100,
        zIndex: 0,
      };
    }

    // TILE layers
    if (layer.category === LayerCategory.GOES_19) {
      return {
        id: layer.id,
        type: LayerType.TILE,
        category: LayerCategory.GOES_19,
        visible: false,
        opacity: 100,
        zIndex: 0,
        availablePeriods: layer.availablePeriods,
        playback: {
          isPlaying: false,
          timeIndex: 0,
          speed: 1,
          lastImagesCount: 1,
        },
      };
    }

    if (layer.category === LayerCategory.RADAR) {
      return {
        id: layer.id,
        type: LayerType.TILE,
        category: LayerCategory.RADAR,
        visible: false,
        opacity: 100,
        zIndex: 0,
        playback: {
          isPlaying: false,
          timeIndex: 0,
          speed: 1,
          lastImagesCount: 1,
        },
        elevation: {
          elevationIndex: 0,
        },
      };
    }

    // Fallback should not happen but TypeScript requires it
    throw new Error(`Unknown layer configuration`);
  }

  private _saveState(controls: LayerControls[]): void {
    // Filter to only save controls with meaningful state
    const state = controls.filter(
      (c) => c.visible || c.opacity !== 100 || c.zIndex !== 0 || 
      (c.type === LayerType.TILE && c.playback)
    );

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private _loadState(): LayerControls[] | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  private _getNextZIndex(zIndexGroup: ActiveLayerGroup): number {
    const controlsInGroup = Array.from(this._controls().values())
      .map(controls => ({ controls, layer: this.layersService.getLayerById(controls.id) }))
      .filter(({ controls, layer }) => 
        layer && 
        layer.zIndexGroup === zIndexGroup && 
        controls.zIndex !== undefined
      );

    if (controlsInGroup.length === 0) {
      return 0;
    }

    const maxZIndex = Math.max(...controlsInGroup.map(({ controls }) => controls.zIndex!));
    return maxZIndex + 1;
  }

  private _updateControls(layerId: string, updateFn: (controls: LayerControls) => void): void {
    this._controls.update((controlsMap) => {
      const newMap = new Map(controlsMap);
      const controls = newMap.get(layerId);
      if (controls) {
        // Deep copy to ensure immutability
        let updatedControls: LayerControls;
        
        if (controls.type === LayerType.TILE) {
          updatedControls = {
            ...controls,
            playback: { ...controls.playback },
          };
          
          if ('elevation' in controls) {
            (updatedControls as RadarLayerControls).elevation = { ...controls.elevation };
          }
        } else {
          updatedControls = { ...controls };
        }
        
        updateFn(updatedControls);
        newMap.set(layerId, updatedControls);
      }
      return newMap;
    });
  }
}
