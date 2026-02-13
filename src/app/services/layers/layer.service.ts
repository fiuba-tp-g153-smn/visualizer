import { Injectable, signal, computed, effect } from '@angular/core';
import {
  ActiveLayerGroup,
  Layer,
  LayerGroup,
  LayerState,
  LayerType,
  TileLayer,
} from '../../models';
import { ACTIVE_LAYER_GROUP_DEFINITIONS } from '../../config/layer-groups/active-groups.config';
import { LAYER_DEFINITIONS } from '../../config/layer-definitions';
import { DEFAULT_ACTIVE_LAYERS } from '../../config/default-active-layers.config';

/**
 * Type guard para verificar si una capa es de tipo TILE (con timeControl)
 */
function isTileLayer(layer: Layer): layer is TileLayer {
  return layer.type === LayerType.TILE;
}

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  private readonly STORAGE_KEY = 'smn-active-layers-v2';
  private readonly _layerGroups = signal<LayerGroup[]>(this._initializeLayerGroups());

  // Intervalos de reproducción activos
  private playIntervals = new Map<string, any>();

  public readonly layerGroups = this._layerGroups.asReadonly();

  // Capas activas agrupadas por z-index group
  public readonly activeLayers = computed(() => {
    const allLayers = this._getAllLayers();
    return allLayers
      .filter((layer: Layer) => layer.visible)
      .sort((a: Layer, b: Layer) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  });

  /**
   * Obtiene capas activas para un grupo específico
   */
  public getActiveLayersForGroup(groupId: ActiveLayerGroup): Layer[] {
    return this.activeLayers().filter((layer) => layer.zIndexGroup === groupId);
  }

  constructor() {
    // Persistir estado cuando cambian las capas
    effect(() => {
      const layers = this._getAllLayers();
      this._saveState(layers);
    });
  }

  private _initializeLayerGroups(): LayerGroup[] {
    const savedState = this._loadState();
    if (savedState) {
      console.debug('Visualizator: Loaded layer state from storage', savedState.length, 'layers');
    } else {
      console.debug('Visualizator: No saved state, applying defaults');
    }

    // Mapa para búsqueda rápida de estado
    const stateMap = savedState ? new Map(savedState.map((s) => [s.id, s])) : null;

    // Contador auxiliar para z-index inicial de defaults si no hay estado
    let defaultZIndexCounter = 0;

    return LAYER_DEFINITIONS.map((group) => ({
      ...group,
      subgroups: group.subgroups.map((subgroup) => ({
        ...subgroup,
        layers: subgroup.layers.map((layer) => {
          // 1. Si hay estado guardado, aplicar
          if (stateMap) {
            const state = stateMap.get(layer.id);
            if (state) {
              return {
                ...layer,
                visible: state.visible,
                opacity: state.opacity,
                zIndex: state.zIndex,
                ...(isTileLayer(layer) &&
                  state.timeIndex !== undefined && {
                    timeIndex: state.timeIndex,
                  }),
                ...(isTileLayer(layer) &&
                  state.playback && {
                    playback: {
                      ...layer.playback,
                      ...state.playback,
                      isPlaying: false, // Siempre iniciar pausado
                    },
                  }),
              };
            }
            // Si hay estado global pero no para esta capa, seguimos para chequear defaults
          }

          // 2. Si NO hay estado (o no para esta capa), aplicar defaults
          if (DEFAULT_ACTIVE_LAYERS.includes(layer.id)) {
            return {
              ...layer,
              visible: true,
              zIndex: defaultZIndexCounter++,
              opacity: 100, // Opacidad full para defaults
            };
          }

          return layer;
        }),
      })),
    }));
  }

  private _saveState(layers: Layer[]): void {
    const state: LayerState[] = layers.map((layer) => ({
      id: layer.id,
      visible: layer.visible,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      // Solo guardar timeIndex y playback si es TileLayer
      ...(isTileLayer(layer) &&
        layer.timeIndex !== undefined && {
          timeIndex: layer.timeIndex,
        }),
      ...(isTileLayer(layer) &&
        layer.playback && {
          playback: layer.playback,
        }),
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
        layer.zIndex = this._getNextZIndex(layer.zIndexGroup);

        // Initialize playback config for time-based layers if not already set
        if (isTileLayer(layer) && !layer.playback) {
          const availablePeriods = layer.availablePeriods ?? [1];

          // GLM layers: default to latest image (1) for immediate current data view
          // ABI layers: default to 6 images for better temporal context
          let defaultCount: number;
          if (layer.id.startsWith('glm-')) {
            defaultCount = 1; // Show latest image by default
          } else {
            // ABI and others: second option (usually 6) or first if only one
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
        layer.zIndex = this._getNextZIndex(layer.zIndexGroup);
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
      if (isTileLayer(layer)) {
        layer.timeIndex = timeIndex;
      }
    });
  }

  isPlaying(layerId: string): boolean {
    const layer = this.getLayerById(layerId);
    return (layer && isTileLayer(layer) && layer.playback?.isPlaying) || false;
  }

  getPlaySpeed(layerId: string): number {
    const layer = this.getLayerById(layerId);
    return layer && isTileLayer(layer) ? (layer.playback?.speed ?? 1) : 1;
  }

  setPlaySpeed(layerId: string, speed: number): void {
    const clampedSpeed = Math.max(0.4, Math.min(10, speed));
    const wasPlaying = this.isPlaying(layerId);

    this._updateLayer(layerId, (layer) => {
      if (!isTileLayer(layer)) return;

      if (!layer.playback) {
        layer.playback = { isPlaying: false, speed: 1 };
      }
      layer.playback.speed = clampedSpeed;
    });

    if (wasPlaying) {
      const layer = this.getLayerById(layerId);
      if (!layer || !isTileLayer(layer)) return;

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
      if (!isTileLayer(layer)) return;

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
      if (!layer?.visible || !isTileLayer(layer) || !layer.playback?.isPlaying) {
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
      if (isTileLayer(layer) && layer.playback) {
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
        if (isTileLayer(layer) && layer.playback) {
          layer.playback.isPlaying = false;
          layer.playback.maxTimeIndex = undefined;
        }
      });
    });
    this.playIntervals.clear();
  }

  getLastImagesCount(layerId: string): number {
    const layer = this.getLayerById(layerId);
    return layer && isTileLayer(layer) ? (layer.playback?.lastImagesCount ?? 1) : 1;
  }

  setLastImagesCount(layerId: string, count: number): void {
    this._updateLayer(layerId, (layer) => {
      if (!isTileLayer(layer)) return;

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

  /**
   * Mueve una capa hacia arriba (mayor z-index) dentro de su grupo
   * Las capas solo se pueden reordenar dentro de su mismo grupo de z-index
   */
  moveLayerUp(layerId: string): void {
    const layer = this.getLayerById(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    // Filtrar solo capas del mismo grupo
    const visibleLayersInGroup = this.activeLayers().filter(
      (l: Layer) => l.zIndexGroup === layer.zIndexGroup,
    );
    const currentIndex = visibleLayersInGroup.findIndex((l: Layer) => l.id === layerId);

    if (currentIndex > 0) {
      const prevLayer = visibleLayersInGroup[currentIndex - 1];
      this._swapZIndex(layer.id, prevLayer.id);
    }
  }

  /**
   * Mueve una capa hacia abajo (menor z-index) dentro de su grupo
   * Las capas solo se pueden reordenar dentro de su mismo grupo de z-index
   */
  moveLayerDown(layerId: string): void {
    const layer = this.getLayerById(layerId);
    if (!layer?.visible || layer.zIndex === undefined) return;

    // Filtrar solo capas del mismo grupo
    const visibleLayersInGroup = this.activeLayers().filter(
      (l: Layer) => l.zIndexGroup === layer.zIndexGroup,
    );
    const currentIndex = visibleLayersInGroup.findIndex((l: Layer) => l.id === layerId);

    if (currentIndex < visibleLayersInGroup.length - 1) {
      const nextLayer = visibleLayersInGroup[currentIndex + 1];
      this._swapZIndex(layer.id, nextLayer.id);
    }
  }

  setLayerOrder(orderedLayerIds: string[]): void {
    // Los IDs vienen ordenados de arriba hacia abajo en el UI
    // Mayor índice = más arriba en la UI = mayor z-index en Leaflet
    const maxIndex = orderedLayerIds.length - 1;
    orderedLayerIds.forEach((layerId: string, uiIndex: number) => {
      this._updateLayer(layerId, (layer) => {
        if (layer.visible) {
          // Invertir: primera capa en UI (uiIndex=0) → mayor zIndex relativo
          layer.zIndex = maxIndex - uiIndex;
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

  /**
   * Obtiene el siguiente zIndex RELATIVO para una capa dentro de su grupo (0-based)
   */
  private _getNextZIndex(zIndexGroup: ActiveLayerGroup): number {
    const layersInGroup = this._getAllLayers().filter(
      (l: Layer) => l.zIndexGroup === zIndexGroup && l.zIndex !== undefined,
    );

    if (layersInGroup.length === 0) {
      return 0; // Primer capa del grupo
    }

    const maxZIndex = Math.max(...layersInGroup.map((l: Layer) => l.zIndex!));
    return maxZIndex + 1;
  }

  /**
   * Calcula el z-index ABSOLUTO para Leaflet a partir del z-index relativo y el grupo
   * Formula: baseOffset + relativeZIndex
   * - BASE: 0 + relativeZIndex → 0, 1, 2, ...
   * - OVERLAY: 1000 + relativeZIndex → 1000, 1001, 1002, ...
   */
  getAbsoluteZIndex(layer: Layer): number {
    if (layer.zIndex === undefined) return 0;
    const baseOffset = ACTIVE_LAYER_GROUP_DEFINITIONS[layer.zIndexGroup].zIndexRange.min;
    return baseOffset + layer.zIndex;
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
