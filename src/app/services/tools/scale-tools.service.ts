import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { Layer, LayerCategory, LayerControls, ScaleType } from '../../models';
import { STORAGE_KEYS } from '../../constants';
import { LayerControlService } from '../layers/layer-control.service';
import { LayersService } from '../layers/layers.service';

type ScalableLayer = Layer & { scale?: NonNullable<Layer['scale']> };

type ActiveLayerEntryWithScale = {
  layer: ScalableLayer;
  controls: LayerControls;
};

export interface ScaleLayerItem {
  layerId: string;
  layer: ScalableLayer;
  layerName: string;
}

export interface ScaleToolEntry {
  layerId: string;
  layerName: string;
  scale: NonNullable<Layer['scale']>;
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
  private readonly layersService = inject(LayersService);
  private previousDisplayLayerIds = new Set<string>();

  readonly enabled = signal<boolean>(false);
  readonly selectedLayerIdsOrdered = signal<string[]>([]);

  readonly displayItems = computed<ScaleLayerItem[]>(() => {
    const seenRadarProducts = new Set<string>();

    return this.controlService
      .activeLayers()
      .filter((entry): entry is ActiveLayerEntryWithScale => this.hasValidScale(entry.layer))
      .flatMap(({ layer }): ScaleLayerItem[] => {
        if (layer.category === LayerCategory.RADAR) {
          if (seenRadarProducts.has(layer.name)) {
            return [];
          }
          seenRadarProducts.add(layer.name);
          return [{ layerId: layer.id, layer, layerName: layer.name }];
        }

        return [
          {
            layerId: layer.id,
            layer,
            layerName: this.layersService.getLayerFullName(layer),
          },
        ];
      });
  });

  readonly scaleEntries = computed<ScaleToolEntry[]>(() => {
    const itemsById = new Map<string, ScaleLayerItem>(
      this.displayItems().map((item) => [item.layerId, item]),
    );

    return this.selectedLayerIdsOrdered()
      .map((layerId) => itemsById.get(layerId) ?? null)
      .filter((item): item is ScaleLayerItem => item !== null)
      .flatMap((item): ScaleToolEntry[] => {
        if (this.hasValidScale(item.layer)) {
          return [
            {
              layerId: item.layerId,
              layerName: item.layerName,
              scale: item.layer.scale as NonNullable<Layer['scale']>,
            },
          ];
        }
        return [];
      });
  });

  readonly shouldShowScales = computed<boolean>(() => {
    return this.enabled() && this.scaleEntries().length > 0;
  });

  constructor() {
    this.loadStateFromStorage();

    effect(() => {
      this.saveStateToStorage();
    });

    effect(() => {
      const activeItems = this.displayItems();
      const activeLayerIds = new Set(activeItems.map((item) => item.layerId));

      untracked(() => {
        const currentSelection = this.selectedLayerIdsOrdered();

        // Remove deactivated layers from selection
        const filteredSelection = currentSelection.filter((layerId) => activeLayerIds.has(layerId));

        // Auto-select only truly newly activated layers.
        const newLayerIds = Array.from(activeLayerIds).filter(
          (layerId) => !this.previousDisplayLayerIds.has(layerId),
        );

        const updatedSelection = [...filteredSelection];
        for (const layerId of newLayerIds) {
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
   * For RADAR layers multiple layer ids may share the same scale; displayItems
   * deduplicates by product name and uses a representative layer id. This
   * method resolves a given layer id to that representative id when needed.
   */
  private getCanonicalLayerId(layerId: string): string | undefined {
    const items = this.displayItems();

    // If the layerId is already one of the display items, return it directly
    if (items.some((it) => it.layerId === layerId)) return layerId;

    // Otherwise, try to find a display item that represents the same logical
    // layer. For RADAR layers we deduplicate by product name, so match by name.
    const layer = this.layersService.getLayerById(layerId as string);
    if (!layer) return undefined;

    // Match by layer name to find the representative item
    const match = items.find((it) => it.layer.name === layer.name);
    return match?.layerId;
  }

  clearSelection(): void {
    this.selectedLayerIdsOrdered.set([]);
  }

  private hasValidScale(layer: Layer): layer is ScalableLayer {
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

  private loadStateFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SCALE_TOOLS);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedScaleToolsState;

      this.enabled.set(parsed.enabled ?? false);
      this.selectedLayerIdsOrdered.set(parsed.selectedLayerIdsOrdered ?? []);
    } catch {
      this.enabled.set(false);
      this.selectedLayerIdsOrdered.set([]);
    }
  }

  private saveStateToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: PersistedScaleToolsState = {
      enabled: this.enabled(),
      selectedLayerIdsOrdered: this.selectedLayerIdsOrdered(),
    };

    try {
      localStorage.setItem(STORAGE_KEYS.SCALE_TOOLS, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors.
    }
  }
}
