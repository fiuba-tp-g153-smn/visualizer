import { Injectable, signal, computed } from '@angular/core';
import { Layer, LayerGroup } from '../models';
import { LAYER_DEFINITIONS } from '../config/layer-definitions';

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  private readonly _layerGroups = signal<LayerGroup[]>(LAYER_DEFINITIONS);

  public readonly layerGroups = this._layerGroups.asReadonly();

  public readonly activeLayers = computed(() => {
    const allLayers = this._getAllLayers();
    return allLayers
      .filter((layer: Layer) => layer.visible)
      .sort((a: Layer, b: Layer) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  });

  // ==========================================================================
  // Visibilidad y Opacidad
  // ==========================================================================

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

  // ==========================================================================
  // Reordenamiento (drag & drop / flechas)
  // ==========================================================================

  moveLayerUp(layerId: string): void {
    const layer = this._findLayer(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    const visibleLayers = this.activeLayers();
    const currentIndex = visibleLayers.findIndex((l: Layer) => l.id === layerId);

    if (currentIndex < visibleLayers.length - 1) {
      const nextLayer = visibleLayers[currentIndex + 1];
      this._swapZIndex(layer.id, nextLayer.id);
    }
  }

  moveLayerDown(layerId: string): void {
    const layer = this._findLayer(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    const visibleLayers = this.activeLayers();
    const currentIndex = visibleLayers.findIndex((l: Layer) => l.id === layerId);

    if (currentIndex > 0) {
      const prevLayer = visibleLayers[currentIndex - 1];
      this._swapZIndex(layer.id, prevLayer.id);
    }
  }

  setLayerOrder(orderedLayerIds: string[]): void {
    orderedLayerIds.forEach((layerId: string, index: number) => {
      this._updateLayer(layerId, (layer) => {
        if (layer.visible) {
          layer.zIndex = index;
        }
      });
    });
  }

  // ==========================================================================
  // Métodos privados
  // ==========================================================================

  private _getAllLayers(): Layer[] {
    const layers: Layer[] = [];
    for (const group of this._layerGroups()) {
      for (const subgroup of group.subgroups) {
        layers.push(...subgroup.layers);
      }
    }
    return layers;
  }

  private _findLayer(layerId: string): Layer | undefined {
    return this._getAllLayers().find((layer: Layer) => layer.id === layerId);
  }

  private _getNextZIndex(): number {
    const maxZIndex = Math.max(
      0,
      ...this._getAllLayers()
        .filter((l: Layer) => l.zIndex !== undefined)
        .map((l: Layer) => l.zIndex!)
    );
    return maxZIndex + 1;
  }

  private _swapZIndex(layerId1: string, layerId2: string): void {
    const layer1 = this._findLayer(layerId1);
    const layer2 = this._findLayer(layerId2);

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
