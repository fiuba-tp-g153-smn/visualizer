import { Injectable, inject, computed, signal, effect } from '@angular/core';
import { Layer, LayerType, LayerCategory, ActiveLayerGroup } from '../../models';
import { LayersService } from './layers.service';
import { ACTIVE_LAYER_GROUP_DEFINITIONS } from '../../config/layers/active-groups.config';
import { DEFAULT_ACTIVE_LAYERS } from '../../config/layers/default';

interface LayerStateStorage {
  id: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
  timeIndex?: number;
  elevationIndex?: number;
  playback?: {
    isPlaying: boolean;
    speed: number;
    lastImagesCount: number;
    maxTimeIndex?: number;
    minTimeIndex?: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class LayerControlService {
  private readonly STORAGE_KEY = 'smn-active-layers-v2';
  private readonly layersService = inject(LayersService);
  private readonly _layers = signal<Map<string, Layer>>(new Map());
  private readonly playIntervals = new Map<string, any>();

  public readonly layers = computed(() => Array.from(this._layers().values()));

  public readonly activeLayers = computed(() => {
    return this.layers()
      .filter((layer) => layer.visible)
      .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  });

  constructor() {
    this._initializeLayers();

    effect(() => {
      const layers = this.layers();
      this._saveState(layers);
    });
  }

  getActiveLayersForGroup(groupId: ActiveLayerGroup): Layer[] {
    return this.activeLayers().filter((layer) => layer.zIndexGroup === groupId);
  }

  getLayerById(layerId: string): Layer | undefined {
    return this._layers().get(layerId);
  }

  activateLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      if (!layer.visible) {
        layer.visible = true;
        layer.zIndex = this._getNextZIndex(layer.zIndexGroup);
        layer.opacity = layer.opacity ?? 100;

        if (layer.type === LayerType.TILE && !layer.playback) {
          const availablePeriods = layer.availablePeriods ?? [1];

          let defaultCount: number;
          if (layer.id.startsWith('glm-')) {
            defaultCount = 1;
          } else {
            defaultCount = availablePeriods.length > 1 ? availablePeriods[1] : availablePeriods[0];
          }

          layer.playback = {
            isPlaying: false,
            speed: 1,
            lastImagesCount: defaultCount,
          };
        }
      }
    });
  }

  deactivateLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      layer.visible = false;
    });
  }

  replaceAllWithLayer(layerId: string): void {
    this._layers.update((layersMap) => {
      const newMap = new Map(layersMap);
      newMap.forEach((layer) => {
        layer.visible = false;
      });
      return newMap;
    });
    this.activateLayer(layerId);
  }

  toggleLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      layer.visible = !layer.visible;
      if (layer.visible) {
        layer.zIndex = layer.zIndex ?? this._getNextZIndex(layer.zIndexGroup);
        layer.opacity = layer.opacity ?? 100;
      }
    });
  }

  getAbsoluteZIndex(layer: Layer): number {
    if (layer.zIndex === undefined) return 0;
    const baseOffset = ACTIVE_LAYER_GROUP_DEFINITIONS[layer.zIndexGroup].zIndexRange.min;
    return baseOffset + layer.zIndex;
  }

  setOpacity(layerId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    this._updateLayer(layerId, (layer) => {
      layer.opacity = clampedOpacity;
    });
  }

  setTimeIndex(layerId: string, timeIndex: number): void {
    this._updateLayer(layerId, (layer) => {
      if (layer.type === LayerType.TILE) {
        layer.timeIndex = timeIndex;
      }
    });
  }

  setElevationIndex(layerId: string, elevationIndex: number): void {
    this._updateLayer(layerId, (layer) => {
      if (layer.type === LayerType.TILE) {
        layer.elevationIndex = elevationIndex;
      }
    });
  }

  isPlaying(layerId: string): boolean {
    const layer = this.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE) return false;
    return layer.playback?.isPlaying ?? false;
  }

  getPlaySpeed(layerId: string): number {
    const layer = this.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE) return 1;
    return layer.playback?.speed ?? 1;
  }

  setPlaySpeed(layerId: string, speed: number): void {
    const clampedSpeed = Math.max(0.4, Math.min(10, speed));
    const wasPlaying = this.isPlaying(layerId);

    this._updateLayer(layerId, (layer) => {
      if (layer.type === LayerType.TILE) {
        if (!layer.playback) {
          layer.playback = { isPlaying: false, speed: 1, lastImagesCount: 1 };
        }
        layer.playback.speed = clampedSpeed;
      }
    });

    if (wasPlaying) {
      const layer = this.getLayerById(layerId);
      if (!layer || layer.type !== LayerType.TILE) return;

      const maxTimeIndex = layer.playback?.maxTimeIndex ?? 0;
      const lastImagesCount = layer.playback?.lastImagesCount ?? 1;
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

    this._updateLayer(layerId, (layer) => {
      if (layer.type === LayerType.TILE) {
        layer.playback = {
          isPlaying: true,
          speed: layer.playback?.speed || 1,
          maxTimeIndex,
          minTimeIndex,
          lastImagesCount: layer.playback?.lastImagesCount ?? 1,
        };

        const current = layer.timeIndex ?? maxTimeIndex;
        layer.timeIndex = Math.max(minTimeIndex, Math.min(current, maxTimeIndex));
      }
    });

    const speed = this.getPlaySpeed(layerId);
    const interval = setInterval(() => {
      const layer = this.getLayerById(layerId);
      if (!layer?.visible || layer.type !== LayerType.TILE) {
        this.stopPlayback(layerId);
        return;
      }

      if (!layer.playback?.isPlaying) {
        this.stopPlayback(layerId);
        return;
      }

      const max = layer.playback.maxTimeIndex ?? maxTimeIndex;
      const min = layer.playback.minTimeIndex ?? minTimeIndex;
      const current = layer.timeIndex ?? min;

      this.setTimeIndex(layerId, current >= max ? min : current + 1);
    }, speed * 1000);

    this.playIntervals.set(layerId, interval);
  }

  stopPlayback(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      if (layer.type === LayerType.TILE && layer.playback) {
        layer.playback.isPlaying = false;
        layer.playback.maxTimeIndex = undefined;
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
      this._updateLayer(layerId, (layer) => {
        if (layer.type === LayerType.TILE && layer.playback) {
          layer.playback.isPlaying = false;
          layer.playback.maxTimeIndex = undefined;
        }
      });
    });
    this.playIntervals.clear();
  }

  getLastImagesCount(layerId: string): number {
    const layer = this.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE) return 1;
    return layer.playback?.lastImagesCount ?? 1;
  }

  setLastImagesCount(layerId: string, count: number): void {
    this._updateLayer(layerId, (layer) => {
      if (layer.type === LayerType.TILE) {
        if (!layer.playback) {
          layer.playback = {
            isPlaying: false,
            speed: 1.0,
            lastImagesCount: count,
          };
        } else {
          layer.playback.lastImagesCount = count;
        }
      }
    });
  }

  moveLayerUp(layerId: string): void {
    const layer = this.getLayerById(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    const visibleLayersInGroup = this.activeLayers().filter(
      (l) => l.zIndexGroup === layer.zIndexGroup,
    );
    const currentIndex = visibleLayersInGroup.findIndex((l) => l.id === layerId);

    if (currentIndex > 0) {
      const prevLayer = visibleLayersInGroup[currentIndex - 1];
      this._swapZIndex(layer.id, prevLayer.id);
    }
  }

  moveLayerDown(layerId: string): void {
    const layer = this.getLayerById(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    const visibleLayersInGroup = this.activeLayers().filter(
      (l) => l.zIndexGroup === layer.zIndexGroup,
    );
    const currentIndex = visibleLayersInGroup.findIndex((l) => l.id === layerId);

    if (currentIndex < visibleLayersInGroup.length - 1) {
      const nextLayer = visibleLayersInGroup[currentIndex + 1];
      this._swapZIndex(layer.id, nextLayer.id);
    }
  }

  setLayerOrder(orderedLayerIds: string[]): void {
    const maxIndex = orderedLayerIds.length - 1;
    orderedLayerIds.forEach((layerId: string, uiIndex: number) => {
      this._updateLayer(layerId, (layer) => {
        if (layer.visible) {
          layer.zIndex = maxIndex - uiIndex;
        }
      });
    });
  }

  private _swapZIndex(layerId1: string, layerId2: string): void {
    const layer1 = this.getLayerById(layerId1);
    const layer2 = this.getLayerById(layerId2);

    if (!layer1?.zIndex || !layer2?.zIndex) return;

    const tempZIndex = layer1.zIndex;
    this._updateLayer(layerId1, (layer) => {
      layer.zIndex = layer2!.zIndex;
    });
    this._updateLayer(layerId2, (layer) => {
      layer.zIndex = tempZIndex;
    });
  }

  private _initializeLayers(): void {
    const savedState = this._loadState();
    if (savedState) {
      console.debug('Visualizer: Loaded layer state from storage', savedState.length, 'layers');
    } else {
      console.debug('Visualizer: No saved state, applying defaults');
    }

    const stateMap = savedState ? new Map(savedState.map((s) => [s.id, s])) : null;
    const layersMap = new Map<string, Layer>();
    let defaultZIndexCounter = 0;

    for (const layerDef of this.layersService.getAllLayers()) {
      let layer: Layer = { ...layerDef };

      if (stateMap) {
        const state = stateMap.get(layer.id);
        if (state) {
          layer = {
            ...layer,
            visible: state.visible,
            opacity: state.opacity,
            zIndex: state.zIndex,
          };

          if (layer.type === LayerType.TILE) {
            if (state.timeIndex !== undefined) {
              layer.timeIndex = state.timeIndex;
            }
            if (state.elevationIndex !== undefined) {
              layer.elevationIndex = state.elevationIndex;
            }
            if (state.playback) {
              layer.playback = {
                ...state.playback,
                isPlaying: false,
              };
            }
          }
        }
      } else if (DEFAULT_ACTIVE_LAYERS.includes(layer.id)) {
        layer.visible = true;
        layer.zIndex = defaultZIndexCounter++;
        layer.opacity = 100;
      }

      layersMap.set(layer.id, layer);
    }

    this._layers.set(layersMap);
  }

  private _saveState(layers: Layer[]): void {
    const state: LayerStateStorage[] = layers
      .filter((layer) => layer.visible || layer.opacity !== undefined || layer.zIndex !== undefined)
      .map((layer) => {
        const baseState: LayerStateStorage = {
          id: layer.id,
          visible: layer.visible ?? false,
          opacity: layer.opacity ?? 100,
          zIndex: layer.zIndex ?? 0,
        };

        if (layer.type === LayerType.TILE) {
          if (layer.timeIndex !== undefined) {
            baseState.timeIndex = layer.timeIndex;
          }
          if (layer.elevationIndex !== undefined) {
            baseState.elevationIndex = layer.elevationIndex;
          }
          if (layer.playback) {
            baseState.playback = layer.playback;
          }
        }

        return baseState;
      });

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private _loadState(): LayerStateStorage[] | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  private _getNextZIndex(zIndexGroup: ActiveLayerGroup): number {
    const layersInGroup = this.layers().filter(
      (l) => l.zIndexGroup === zIndexGroup && l.zIndex !== undefined,
    );

    if (layersInGroup.length === 0) {
      return 0;
    }

    const maxZIndex = Math.max(...layersInGroup.map((l) => l.zIndex!));
    return maxZIndex + 1;
  }

  private _updateLayer(layerId: string, updateFn: (layer: Layer) => void): void {
    this._layers.update((layersMap) => {
      const newMap = new Map(layersMap);
      const layer = newMap.get(layerId);
      if (layer) {
        const updatedLayer = { ...layer };
        updateFn(updatedLayer);
        newMap.set(layerId, updatedLayer);
      }
      return newMap;
    });
  }
}
