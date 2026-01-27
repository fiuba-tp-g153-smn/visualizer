import { Injectable, signal, computed, effect } from '@angular/core';
import { Layer, LayerGroup, LayerPlaybackConfig } from '../models';
import { LAYER_DEFINITIONS } from '../config/layer-definitions';

interface LayerState {
  id: string;
  visible: boolean;
  opacity: number;
  zIndex?: number;
  timeIndex?: number;
  playback?: LayerPlaybackConfig;
}

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  private readonly STORAGE_KEY = 'smn-active-layers';
  private readonly _layerGroups = signal<LayerGroup[]>(this._initializeLayerGroups());

  // Intervalos de reproducción activos
  private playIntervals = new Map<string, any>();

  public readonly layerGroups = this._layerGroups.asReadonly();

  public readonly activeLayers = computed(() => {
    const allLayers = this._getAllLayers();
    return allLayers
      .filter((layer: Layer) => layer.visible)
      .sort((a: Layer, b: Layer) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  });

  constructor() {
    // Persistir estado cuando cambian las capas
    effect(() => {
      const layers = this._getAllLayers();
      this._saveState(layers);
    });
  }

  private _initializeLayerGroups(): LayerGroup[] {
    return LAYER_DEFINITIONS;
  }

  private _saveState(layers: Layer[]): void {
    const state: LayerState[] = layers.map((layer) => ({
      id: layer.id,
      visible: layer.visible,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      timeIndex: layer.timeIndex,
      playback: layer.playback,
    }));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private _loadState(): LayerState[] | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  activateLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      if (!layer.visible) {
        layer.visible = true;
        layer.zIndex = this._getNextZIndex();
      }
    });
  }

  deactivateLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      layer.visible = false;
    });
  }

  replaceAllWithLayer(layerId: string): void {
    this._layerGroups.update((groups: LayerGroup[]) => {
      return groups.map((group) => ({
        ...group,
        subgroups: group.subgroups.map((subgroup) => ({
          ...subgroup,
          layers: subgroup.layers.map((layer) => ({
            ...layer,
            visible: false,
          })),
        })),
      }));
    });

    this.activateLayer(layerId);
  }

  toggleLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      layer.visible = !layer.visible;
      if (layer.visible && layer.zIndex === undefined) {
        layer.zIndex = this._getNextZIndex();
      }
    });
  }

  setOpacity(layerId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    this._updateLayer(layerId, (layer) => {
      layer.opacity = clampedOpacity;
    });
  }

  setTimeIndex(layerId: string, timeIndex: number): void {
    this._updateLayer(layerId, (layer) => {
      layer.timeIndex = timeIndex;
    });
  }

  isPlaying(layerId: string): boolean {
    const layer = this.getLayerById(layerId);
    return layer?.playback?.isPlaying || false;
  }

  getPlaySpeed(layerId: string): number {
    const layer = this.getLayerById(layerId);
    return layer?.playback?.speed || 1;
  }

  setPlaySpeed(layerId: string, speed: number): void {
    const clampedSpeed = Math.max(0.4, Math.min(10, speed));
    const wasPlaying = this.isPlaying(layerId);

    this._updateLayer(layerId, (layer) => {
      if (!layer.playback) {
        layer.playback = { isPlaying: false, speed: 1 };
      }
      layer.playback.speed = clampedSpeed;
    });

    if (wasPlaying) {
      const layer = this.getLayerById(layerId);
      const maxTimeIndex = layer?.playback?.maxTimeIndex ?? 0;
      const lastImagesCount = layer?.playback?.lastImagesCount ?? 1;
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
      layer.playback = {
        isPlaying: true,
        speed: layer.playback?.speed || 1,
        maxTimeIndex,
        minTimeIndex,
        lastImagesCount: layer.playback?.lastImagesCount,
      };

      // Clamp current time index to new range
      const current = layer.timeIndex ?? maxTimeIndex;
      layer.timeIndex = Math.max(minTimeIndex, Math.min(current, maxTimeIndex));
    });

    const speed = this.getPlaySpeed(layerId);
    const interval = setInterval(() => {
      const layer = this.getLayerById(layerId);
      if (!layer?.visible || !layer.playback?.isPlaying) {
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
      if (layer.playback) {
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
        if (layer.playback) {
          layer.playback.isPlaying = false;
          layer.playback.maxTimeIndex = undefined;
        }
      });
    });
    this.playIntervals.clear();
  }

  getLastImagesCount(layerId: string): number {
    const layer = this.getLayerById(layerId);
    return layer?.playback?.lastImagesCount ?? 1;
  }

  setLastImagesCount(layerId: string, count: number): void {
    this._updateLayer(layerId, (layer) => {
      if (!layer.playback) {
        layer.playback = {
          isPlaying: false,
          speed: 1.0,
          lastImagesCount: count,
        };
      } else {
        layer.playback.lastImagesCount = count;
      }
    });
  }

  moveLayerUp(layerId: string): void {
    const layer = this.getLayerById(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    const visibleLayers = this.activeLayers();
    const currentIndex = visibleLayers.findIndex((l: Layer) => l.id === layerId);

    if (currentIndex > 0) {
      const prevLayer = visibleLayers[currentIndex - 1];
      this._swapZIndex(layer.id, prevLayer.id);
    }
  }

  moveLayerDown(layerId: string): void {
    const layer = this.getLayerById(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    const visibleLayers = this.activeLayers();
    const currentIndex = visibleLayers.findIndex((l: Layer) => l.id === layerId);

    if (currentIndex < visibleLayers.length - 1) {
      const nextLayer = visibleLayers[currentIndex + 1];
      this._swapZIndex(layer.id, nextLayer.id);
    }
  }

  setLayerOrder(orderedLayerIds: string[]): void {
    const maxZIndex = orderedLayerIds.length;
    orderedLayerIds.forEach((layerId: string, index: number) => {
      this._updateLayer(layerId, (layer) => {
        if (layer.visible) {
          layer.zIndex = maxZIndex - index;
        }
      });
    });
  }

  private _getAllLayers(): Layer[] {
    const layers: Layer[] = [];
    for (const group of this._layerGroups()) {
      for (const subgroup of group.subgroups) {
        layers.push(...subgroup.layers);
      }
    }
    return layers;
  }

  getLayerById(layerId: string): Layer | undefined {
    return this._getAllLayers().find((layer: Layer) => layer.id === layerId);
  }

  getLayerDisplayName(layerId: string): string {
    const layer = this.getLayerById(layerId);
    return layer?.name ?? layerId;
  }

  private _getNextZIndex(): number {
    const maxZIndex = Math.max(
      0,
      ...this._getAllLayers()
        .filter((l: Layer) => l.zIndex !== undefined)
        .map((l: Layer) => l.zIndex!),
    );
    return Math.max(1, maxZIndex + 1);
  }

  private _swapZIndex(layerId1: string, layerId2: string): void {
    const layer1 = this.getLayerById(layerId1);
    const layer2 = this.getLayerById(layerId2);

    if (!layer1?.zIndex || !layer2?.zIndex) return;

    const tempZIndex = layer1.zIndex;
    this._updateLayer(layerId1, (layer) => {
      layer.zIndex = layer2.zIndex;
    });
    this._updateLayer(layerId2, (layer) => {
      layer.zIndex = tempZIndex;
    });
  }

  private _updateLayer(layerId: string, updateFn: (layer: Layer) => void): void {
    this._layerGroups.update((groups: LayerGroup[]) => {
      const newGroups = groups.map((group) => ({
        ...group,
        subgroups: group.subgroups.map((subgroup) => ({
          ...subgroup,
          layers: subgroup.layers.map((layer) => {
            if (layer.id === layerId) {
              const updatedLayer = { ...layer };
              updateFn(updatedLayer);
              return updatedLayer;
            }
            return layer;
          }),
        })),
      }));
      return newGroups;
    });
  }
}
