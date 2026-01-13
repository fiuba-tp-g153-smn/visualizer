import { Injectable, signal, computed, effect } from '@angular/core';
import { Layer, LayerGroup } from '../models';
import { LAYER_DEFINITIONS } from '../config/layer-definitions';

interface LayerState {
  id: string;
  visible: boolean;
  opacity: number;
  zIndex?: number;
  timeIndex?: number;
}

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  private readonly STORAGE_KEY = 'smn-active-layers';
  private readonly _layerGroups = signal<LayerGroup[]>(this._initializeLayerGroups());

  public readonly layerGroups = this._layerGroups.asReadonly();

  public readonly activeLayers = computed(() => {
    const allLayers = this._getAllLayers();
    return allLayers
      .filter((layer: Layer) => layer.visible)
      .sort((a: Layer, b: Layer) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  });

  constructor() {
    // Persistir estado cuando cambian las capas
    effect(() => {
      const layers = this._getAllLayers();
      this._saveState(layers);
    });
  }

  // ==========================================================================
  // Persistencia
  // ==========================================================================

  private _initializeLayerGroups(): LayerGroup[] {
    // TEMPORALMENTE DESHABILITADO PARA DEBUG
    // const savedState = this._loadState();
    // if (!savedState) {
    //   return LAYER_DEFINITIONS;
    // }
    
    // Usar siempre las definiciones por defecto (sin localStorage)
    return LAYER_DEFINITIONS;

    // CÓDIGO ORIGINAL COMENTADO (restaurar estado guardado):
    // return LAYER_DEFINITIONS.map((group) => ({
    //   ...group,
    //   subgroups: group.subgroups.map((subgroup) => ({
    //     ...subgroup,
    //     layers: subgroup.layers.map((layer) => {
    //       const saved = savedState.find((s) => s.id === layer.id);
    //       if (saved) {
    //         return {
    //           ...layer,
    //           visible: saved.visible,
    //           opacity: saved.opacity,
    //           zIndex: saved.zIndex,
    //           timeIndex: saved.timeIndex ?? 0,
    //         };
    //       }
    //       return layer;
    //     }),
    //   })),
    // }));
  }

  private _saveState(layers: Layer[]): void {
    const state: LayerState[] = layers.map((layer) => ({
      id: layer.id,
      visible: layer.visible,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      timeIndex: layer.timeIndex,
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

  // ==========================================================================
  // Visibilidad y Opacidad
  // ==========================================================================

  /**
   * Activa una capa (agrega a las activas)
   */
  activateLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      if (!layer.visible) {
        layer.visible = true;
        layer.zIndex = this._getNextZIndex();
      }
    });
  }

  /**
   * Desactiva una capa (remueve de las activas)
   */
  deactivateLayer(layerId: string): void {
    this._updateLayer(layerId, (layer) => {
      layer.visible = false;
    });
  }

  /**
   * Reemplaza todas las capas activas con una nueva capa
   */
  replaceAllWithLayer(layerId: string): void {
    // Primero desactivar todas
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

    // Luego activar la seleccionada
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

  /**
   * Cambia el índice temporal (tileset) de una capa
   */
  setTimeIndex(layerId: string, timeIndex: number): void {
    this._updateLayer(layerId, (layer) => {
      layer.timeIndex = timeIndex;
    });
    console.log(`⏱️ TimeIndex de ${layerId} cambiado a: ${timeIndex}`);
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
