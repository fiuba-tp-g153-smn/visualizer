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
} from '../../models';
import { LayersService } from './layers.service';
import { ACTIVE_LAYER_GROUP_DEFINITIONS } from '../../config/layers/active-groups.config';
import { DEFAULT_ACTIVE_LAYERS } from '../../config/layers/default';
import { LayerConfigService } from './layer-config.service';

@Injectable({
  providedIn: 'root',
})
export class LayerControlService {
  private readonly STORAGE_KEY = 'smn-active-layers-v2';

  private readonly layersService = inject(LayersService);
  private readonly layerConfigService = inject(LayerConfigService);

  private readonly controls = signal<Map<string, LayerControls>>(new Map());
  private readonly playIntervals = new Map<string, number>(); // Map of layerId to interval ID for playback

  constructor() {
    this.initializeControls();

    effect(() => {
      this.saveControls();
    });
  }

  public readonly activeLayers = computed(() => {
    const allLayers = this.layersService.getAllLayers();
    return allLayers
      .map((layer) => {
        const controls = this.controls().get(layer.id);
        return controls?.visible ? { layer, controls } : null;
      })
      .filter((item): item is { layer: Layer; controls: LayerControls } => item !== null)
      .sort((a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0));
  });

  getActiveLayersForGroup(
    groupId: ActiveLayerGroupId,
  ): { layer: Layer; controls: LayerControls }[] {
    return this.activeLayers().filter(({ layer }) => layer.zIndexGroup === groupId);
  }

  getLayerById(layerId: string): Layer | null {
    return this.layersService.getLayerById(layerId);
  }

  getControls(layerId: string): LayerControls | null {
    return this.controls().get(layerId) ?? null;
  }

  private isActive(layerId: string): boolean {
    const controls = this.getControls(layerId);
    return controls?.visible ?? false;
  }

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
  }

  replaceAllWithLayer(layerId: string): void {
    this.activeLayers().forEach(({ layer }) => {
      if (layer.id !== layerId) {
        this.deactivateLayer(layer.id);
      }
    });

    this.activateLayer(layerId);
  }

  getAbsoluteZIndex(layerId: string, controls: LayerControls): number | null {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return null;
    if (controls.zIndex === undefined) return null;
    const baseOffset = ACTIVE_LAYER_GROUP_DEFINITIONS[layer.zIndexGroup].zIndexRange.min;
    return baseOffset + controls.zIndex;
  }

  setOpacity(layerId: string, opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    this.updateControls(layerId, (controls) => {
      controls.opacity = clampedOpacity;
    });
  }

  setTimeIndex(layerId: string, timeIndex: number): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.timeIndex = timeIndex;
      }
    });
  }

  setElevationIndex(layerId: string, elevationIndex: number): void {
    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.category === LayerCategory.RADAR) {
        controls.elevation.elevationIndex = elevationIndex;
      }
    });
  }

  isPlaying(layerId: string): boolean {
    const controls = this.getControls(layerId);
    if (!controls || controls.type !== LayerType.TILE) return false;
    return controls.playback?.isPlaying ?? false;
  }

  // getPlaySpeed(layerId: string): number | null {
  //   const controls = this.getControls(layerId);
  //   if (!controls || controls.type !== LayerType.TILE) return null;
  //   return controls.playback.speed ?? null;
  // }

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
    if (this.isPlaying(layerId)) {
      const interval = this.playIntervals.get(layerId);
      if (interval) {
        clearInterval(interval);
        this.playIntervals.delete(layerId);
      }
    }

    const controls = this.getControls(layerId);
    if (!controls || controls.type !== LayerType.TILE) return;

    let lastImagesCount = controls.playback.lastImagesCount;

    const availablePeriods = this.availablePeriodsForLayer(layerId);
    if (availablePeriods.length === 0) return;

    // El índice inicial debe ser:
    // si el largo de períodos disponibles es mayor que la cantidad de últimas imágenes a mostrar, entonces el índice inicial es la cantidad de períodos menos la cantidad de últimas imágenes a mostrar para mostrar solo las últimas imágenes disponibles
    // si no, el índice inicial es 0 para mostrar desde el primer período disponible
    const maxTimeIndex = availablePeriods.length - 1;
    const minTimeIndex = Math.max(0, maxTimeIndex - lastImagesCount + 1);

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

    this.playIntervals.set(layerId, interval);

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

  stopPlayback(layerId: string): void {
    if (!this.isActive(layerId)) return;
    if (!this.isPlaying(layerId)) return;

    const interval = this.playIntervals.get(layerId);
    if (interval) {
      clearInterval(interval);
      this.playIntervals.delete(layerId);
    }

    this.updateControls(layerId, (controls) => {
      if (controls.type === LayerType.TILE && controls.playback) {
        controls.playback.isPlaying = false;
      }
    });
  }

  private availablePeriodsForLayer(layerId: string): string[] {
    const config = this.layerConfigService.getConfig(layerId);
    if (!config) return [];

    switch (config.type) {
      case LayerType.TILE:
        switch (config.category) {
          case LayerCategory.GOES_19:
            return config.availableTilesets;
          case LayerCategory.RADAR:
            const controls = this.getControls(layerId);
            if (
              !controls ||
              controls.type !== LayerType.TILE ||
              controls.category !== LayerCategory.RADAR
            ) {
              throw new Error(`Expected radar tile layer controls for radar tile layer config`);
            }

            if (controls.elevation.elevationIndex === undefined) {
              throw new Error(
                `Elevation index must be selected for radar layers to determine available periods`,
              );
            }

            const layer = this.layersService.getLayerById(layerId);
            if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.RADAR) {
              throw new Error(`Expected radar tile layer for radar tile layer config`);
            }

            const elevationKey = layer.availableElevations[controls.elevation.elevationIndex];

            if (!elevationKey) {
              throw new Error(
                `Selected elevation index ${controls.elevation.elevationIndex} is out of bounds for available elevations in layer definition`,
              );
            }

            const tilesetsForElevation = config.availableTilesetsByElevation[elevationKey];

            if (!tilesetsForElevation) {
              throw new Error(
                `No tilesets found for elevation ${elevationKey} in radar layer config`,
              );
            }

            return tilesetsForElevation;
          default:
            throw new Error(`Playback controls can only be applied to tile layers`);
        }
      default:
        throw new Error(`Only tile layers have available periods for playback`);
    }
  }

  setLastImagesCount(layerId: string, count: number): void {
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
  }

  // Usado para el drap and drop dentro de un grupo, debe recibir el orden completo de capas del grupo luego del cambio para recalcular los zIndex
  setActiveGroupLayersOrder(
    activeLayerGroupId: ActiveLayerGroupId,
    orderedLayerIds: string[],
  ): void {
    // Primero desactivo las capas del grupo ya que no debería estar prendido ninguna no especificada en el nuevo orden
    this.getActiveLayersForGroup(activeLayerGroupId).forEach(({ layer }) => {
      if (this.isActive(layer.id)) {
        this.updateControls(layer.id, (controls) => {
          controls.zIndex = undefined;
          controls.visible = false;
        });
      }
    });

    // A su vez ninguna que no esté prendida aún puede tener un zIndex asignado por lo que también se limpian los zIndex de las capas del grupo que no estén en el nuevo orden para evitar inconsistencias
    const filteredIds = orderedLayerIds.filter((id) => this.isActive(id));
    const maxIndex = filteredIds.length - 1;

    // Luego se asignan los zIndex de acuerdo al nuevo orden
    filteredIds.forEach((layerId: string, uiIndex: number) => {
      this.updateControls(layerId, (controls) => {
        if (controls.visible) {
          controls.zIndex = maxIndex - uiIndex;
        }
      });
    });
  }

  private initializeControls(): void {
    const savedState = this.loadControls();
    if (savedState) {
      console.debug('Visualizer: Loaded layer state from storage', savedState.length, 'controls');
    } else {
      console.debug('Visualizer: No saved state, applying defaults');
    }

    const stateMap = new Map(savedState ? savedState.map((s) => [s.id, s]) : []);
    const controlsMap = new Map<string, LayerControls>();

    // Find max zIndex from saved visible layers to avoid conflicts
    const maxSavedZIndex = savedState
      ? Math.max(
          -1,
          ...savedState.filter((c) => c.visible && c.zIndex !== undefined).map((c) => c.zIndex!),
        )
      : -1;
    let initialZIndex = maxSavedZIndex + 1;

    for (const layer of this.layersService.getAllLayers()) {
      let controls: LayerControls;
      const savedControls = stateMap.get(layer.id);

      if (savedControls) {
        // Restore saved state, but ensure isPlaying is false
        controls = { ...savedControls };
        if (controls.type === LayerType.TILE) {
          controls.playback = {
            ...controls.playback,
            isPlaying: false,
          };
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

  private createDefaultControlsForLayer(layer: Layer): BaseLayerControls {
    return {
      id: layer.id,
      visible: false,
      opacity: 100, // TODO: this should ideally come from layer definition or defaults based on category or environment configuration
      zIndex: 0,
    };
  }

  private createControlsForLayer(layer: Layer): LayerControls {
    const baseControls = this.createDefaultControlsForLayer(layer);

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
            timeIndex: 0,
            speed: 1, // TODO: this should ideally come from layer definition or defaults based on category or environment configuration
            lastImagesCount: 1,
          },
        };
        switch (layer.category) {
          case LayerCategory.GOES_19:
            return {
              ...baseTileControls,
              category: layer.category!,
            } as GoesLayerControls;
          case LayerCategory.RADAR:
            return {
              ...baseTileControls,
              category: layer.category!,
              elevation: {
                elevationIndex: 0,
              },
            } as RadarLayerControls;
          default:
            throw new Error(`Layer category does not have a defined controls template`);
        }
      default:
        throw new Error(`Unsupported layer type`);
    }
  }

  private saveControls(): void {
    const state = this.activeLayers().map(({ controls }) => controls);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private loadControls(): LayerControls[] | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
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
}
