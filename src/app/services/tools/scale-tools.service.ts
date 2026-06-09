import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import {
  EcmwfTpLayerControls,
  Layer,
  LayerCategory,
  LayerControls,
  LayerScale,
  LayerType,
  ScaleType,
  WrfLayerControls,
} from '../../models';
import { PRIMARY_RENDER_ID } from '../../models/layers/controls.models';
import { STORAGE_KEYS } from '../../constants';
import { LayerControlService } from '../layers/layer-control.service';
import { LayersService } from '../layers/layers.service';
import { LocalStorageService } from '../storage/local-storage.service';

type LayerWithScale = Layer & { scale: LayerScale };

type ActiveLayerEntryWithScale = {
  layer: LayerWithScale;
  controls: LayerControls;
};

export interface ScaleLayerItem {
  layerId: string;
  layer: LayerWithScale;
  scaleGroupKey: string;
  layerName: string;
}

export interface ScaleToolEntry {
  layerId: string;
  layerName: string;
  scale: LayerScale;
}

interface PersistedScaleToolsState {
  enabled: boolean;
  selectedLayerIdsOrdered: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ScaleToolsService {
  private readonly MIN_CONTINUOUS_STOPS = 2;
  private readonly MIN_DISCRETE_STEPS = 1;

  private readonly controlService = inject(LayerControlService);
  private readonly storage = inject(LocalStorageService);
  private readonly layersService = inject(LayersService);
  private previousDisplayLayerIds = new Set<string>();
  private restoredSelectionFromStorage = false;

  readonly enabled = signal<boolean>(false);
  readonly selectedLayerIdsOrdered = signal<string[]>([]);

  readonly displayItems = computed<ScaleLayerItem[]>(() => {
    const seenScaleGroupKeys = new Set<string>();

    return this.controlService
      .activeLayers()
      .filter((entry): entry is ActiveLayerEntryWithScale => this.hasValidScale(entry.layer))
      .filter(({ layer, controls }) => this.isPrimaryRenderActive(layer, controls))
      .flatMap(({ layer }) => {
        const scaleGroupKey = this.getScaleGroupKeyForLayer(layer);
        if (seenScaleGroupKeys.has(scaleGroupKey)) {
          return [];
        }
        seenScaleGroupKeys.add(scaleGroupKey);

        const item: ScaleLayerItem = {
          layerId: layer.id,
          layer,
          scaleGroupKey,
          layerName: this.getScaleDisplayName(layer),
        };

        return [item];
      });
  });

  readonly scaleEntries = computed<ScaleToolEntry[]>(() => {
    const itemsById = new Map<string, ScaleLayerItem>(
      this.displayItems().map((item) => [item.layerId, item]),
    );
    const seenScaleGroups = new Set<string>();

    return this.selectedLayerIdsOrdered()
      .map((layerId) => itemsById.get(layerId) ?? null)
      .filter((item): item is ScaleLayerItem => item !== null)
      .flatMap((item): ScaleToolEntry[] => {
        if (seenScaleGroups.has(item.scaleGroupKey)) {
          return [];
        }
        seenScaleGroups.add(item.scaleGroupKey);

        return [
          {
            layerId: item.layerId,
            layerName: item.layerName,
            scale: item.layer.scale,
          },
        ];
      });
  });

  readonly shouldShowScales = computed<boolean>(() => {
    return this.enabled() && this.scaleEntries().length > 0;
  });

  constructor() {
    this.restoredSelectionFromStorage = this.loadStateFromStorage();

    effect(() => {
      this.saveStateToStorage();
    });

    effect(() => {
      const activeItems = this.displayItems();
      const activeLayerIds = new Set(activeItems.map((item) => item.layerId));

      untracked(() => {
        const currentSelection = this.selectedLayerIdsOrdered();
        const isInitialSync = this.previousDisplayLayerIds.size === 0;
        const shouldAutoSelectNewLayers = !(isInitialSync && this.restoredSelectionFromStorage);

        // Remove deactivated layers from selection
        const filteredSelection = currentSelection.filter((layerId) => activeLayerIds.has(layerId));
        const normalizedSelection = this.uniqueCanonicalLayerIds(filteredSelection);

        // Auto-select only truly newly activated layers.
        const newLayerIds = shouldAutoSelectNewLayers
          ? Array.from(activeLayerIds).filter(
              (layerId) => !this.previousDisplayLayerIds.has(layerId),
            )
          : [];
        const newCanonicalIds = this.uniqueCanonicalLayerIds(newLayerIds);

        const updatedSelection = [...normalizedSelection];
        for (const layerId of newCanonicalIds) {
          if (!updatedSelection.includes(layerId)) {
            updatedSelection.push(layerId);
          }
        }

        if (
          updatedSelection.length !== currentSelection.length ||
          !updatedSelection.every((id, i) => currentSelection[i] === id)
        ) {
          this.selectedLayerIdsOrdered.set(updatedSelection);
        }

        // Default behavior: when a new layer is activated, show its palette.
        if (newLayerIds.length > 0 && !this.enabled()) {
          this.enabled.set(true);
        }

        this.previousDisplayLayerIds = activeLayerIds;

        if (isInitialSync) {
          this.restoredSelectionFromStorage = false;
        }
      });
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
  }

  toggleLayerSelection(layerId: string): void {
    const canonical = this.getCanonicalLayerId(layerId);
    if (!canonical) return;

    const current = this.selectedLayerIdsOrdered();
    if (current.includes(canonical)) {
      this.selectedLayerIdsOrdered.set(current.filter((id) => id !== canonical));
      return;
    }

    this.selectedLayerIdsOrdered.set([...current, canonical]);

    if (!this.enabled()) {
      this.enabled.set(true);
    }
  }

  isLayerSelected(layerId: string): boolean {
    const canonical = this.getCanonicalLayerId(layerId);
    if (!canonical) return false;
    return this.selectedLayerIdsOrdered().includes(canonical);
  }

  /**
   * Map any layer id to the canonical display id used by the scale tools.
   * Any layers that belong to the same scale group resolve to a single
   * representative item shown in the tool.
   */
  private getCanonicalLayerId(layerId: string): string | undefined {
    const items = this.displayItems();
    const itemById = new Map(items.map((item) => [item.layerId, item]));

    if (itemById.has(layerId)) {
      return layerId;
    }

    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return undefined;

    const sourceKey = this.getScaleGroupKeyForLayer(layer);
    const byGroup = items.find((it) => it.scaleGroupKey === sourceKey);
    if (byGroup) return byGroup.layerId;

    return undefined;
  }

  private uniqueCanonicalLayerIds(layerIds: readonly string[]): string[] {
    const result: string[] = [];
    for (const layerId of layerIds) {
      const canonical = this.getCanonicalLayerId(layerId);
      if (!canonical || result.includes(canonical)) continue;
      result.push(canonical);
    }
    return result;
  }

  private getScaleGroupKeyForLayer(layer: Layer): string {
    return layer.scale?.scaleRoutingKey ?? layer.id;
  }

  private getScaleDisplayName(layer: Layer): string {
    return layer.scale?.scaleDisplayName ?? layer.name;
  }

  clearSelection(): void {
    this.selectedLayerIdsOrdered.set([]);
  }

  /**
   * Returns false for WRF/ECMWF layers where no selected forecast run has the
   * primary tile visible (e.g. only secondary renders like isobars are shown).
   */
  private isPrimaryRenderActive(layer: Layer, controls: LayerControls): boolean {
    if (layer.type !== LayerType.TILE) return true;
    if (
      layer.category !== LayerCategory.ECMWF_TP &&
      layer.category !== LayerCategory.WRF
    ) {
      return true;
    }

    const forecastControls = (controls as EcmwfTpLayerControls | WrfLayerControls).forecast;
    const selected = forecastControls.selectedForecastTimestamps;
    if (selected.length === 0) return false;

    return selected.some((ts) => {
      const renderControl = forecastControls.renderControls[ts];
      return renderControl ? renderControl.selectedRenderIds.includes(PRIMARY_RENDER_ID) : true;
    });
  }

  private hasValidScale(layer: Layer): layer is LayerWithScale {
    if (!layer.scale) {
      return false;
    }

    switch (layer.scale.type) {
      case ScaleType.CONTINUOUS:
        return layer.scale.entries.length >= this.MIN_CONTINUOUS_STOPS;
      case ScaleType.DISCRETE:
        return layer.scale.entries.length >= this.MIN_DISCRETE_STEPS;
      default:
        return false;
    }
  }

  private loadStateFromStorage(): boolean {
    const parsed = this.storage.getJson<PersistedScaleToolsState>(STORAGE_KEYS.SCALE_TOOLS);
    if (!parsed) return false;
    this.enabled.set(parsed.enabled ?? false);
    this.selectedLayerIdsOrdered.set(parsed.selectedLayerIdsOrdered ?? []);
    return true;
  }

  private saveStateToStorage(): void {
    const payload: PersistedScaleToolsState = {
      enabled: this.enabled(),
      selectedLayerIdsOrdered: this.selectedLayerIdsOrdered(),
    };
    this.storage.setJson(STORAGE_KEYS.SCALE_TOOLS, payload);
  }
}
