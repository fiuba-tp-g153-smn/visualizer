import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { Layer, LayerCategory, LayerControls, LayerType, ScaleType } from '../../models';
import { LayerControlService } from './layer-control.service';
import { LayersService } from './layers.service';

type TileLayerVariant = Extract<Layer, { type: LayerType.TILE }>;

type ActiveTileLayerEntry = {
  layer: TileLayerVariant;
  controls: LayerControls;
};

export interface ScaleLayerItem {
  layerId: string;
  layer: TileLayerVariant;
  layerName: string;
}

export interface ScaleToolEntry {
  layerId: string;
  layerName: string;
  scale: NonNullable<TileLayerVariant['scale']>;
}

interface PersistedScaleToolsState {
  selectedLayerIdsOrdered: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ScaleToolsService {
  private readonly STORAGE_KEY = 'smn-scale-tools-v1';
  private readonly MIN_CONTINUOUS_STOPS = 2;
  private readonly MIN_DISCRETE_STEPS = 1;
  private readonly MIN_PALETTE_ENTRIES = 1;

  private readonly controlService = inject(LayerControlService);
  private readonly layersService = inject(LayersService);

  readonly selectedLayerIdsOrdered = signal<string[]>([]);

  readonly displayItems = computed<ScaleLayerItem[]>(() => {
    const seenRadarProducts = new Set<string>();

    return this.controlService
      .activeLayers()
      .filter((entry): entry is ActiveTileLayerEntry => entry.layer.type === LayerType.TILE)
      .flatMap(({ layer }): ScaleLayerItem[] => {
        const tileLayer = layer;
        if (!this.hasValidScale(tileLayer)) {
          return [];
        }

        // Deduplicate radar layers by product name — all radars share the same scale per product.
        if (tileLayer.category === LayerCategory.RADAR) {
          if (seenRadarProducts.has(tileLayer.name)) {
            return [];
          }
          seenRadarProducts.add(tileLayer.name);
          return [{ layerId: tileLayer.id, layer: tileLayer, layerName: tileLayer.name }];
        }

        return [
          {
            layerId: tileLayer.id,
            layer: tileLayer,
            layerName: this.layersService.getLayerFullName(tileLayer),
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
        if (!this.hasValidScale(item.layer)) {
          return [];
        }

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
    return this.scaleEntries().length > 0;
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

        // Auto-select newly activated layers
        const newLayerIds = activeItems
          .map((item) => item.layerId)
          .filter((layerId) => !currentSelection.includes(layerId));

        const updatedSelection = [...filteredSelection, ...newLayerIds];

        if (
          updatedSelection.length !== currentSelection.length ||
          !updatedSelection.every((id, i) => currentSelection[i] === id)
        ) {
          this.selectedLayerIdsOrdered.set(updatedSelection);
        }
      });
    });
  }

  toggleLayerSelection(layerId: string): void {
    const current = this.selectedLayerIdsOrdered();
    if (current.includes(layerId)) {
      this.selectedLayerIdsOrdered.set(current.filter((id) => id !== layerId));
      return;
    }

    this.selectedLayerIdsOrdered.set([...current, layerId]);
  }

  isLayerSelected(layerId: string): boolean {
    return this.selectedLayerIdsOrdered().includes(layerId);
  }

  clearSelection(): void {
    this.selectedLayerIdsOrdered.set([]);
  }

  private hasValidScale(
    layer: TileLayerVariant,
  ): layer is TileLayerVariant & { scale: NonNullable<TileLayerVariant['scale']> } {
    if (!layer.scale) {
      return false;
    }

    switch (layer.scale.type) {
      case ScaleType.CONTINUOUS:
        return layer.scale.stops.length >= this.MIN_CONTINUOUS_STOPS;
      case ScaleType.DISCRETE:
        return layer.scale.steps.length >= this.MIN_DISCRETE_STEPS;
      case ScaleType.PALETTE_CONFIG:
        return (
          layer.scale.hexColors.length >= this.MIN_PALETTE_ENTRIES &&
          layer.scale.bounds.length >= this.MIN_PALETTE_ENTRIES
        );
      default:
        return false;
    }
  }

  private loadStateFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedScaleToolsState>;

      if (Array.isArray(parsed.selectedLayerIdsOrdered)) {
        this.selectedLayerIdsOrdered.set(
          parsed.selectedLayerIdsOrdered.filter(
            (value): value is string => typeof value === 'string',
          ),
        );
      }
    } catch {
      this.selectedLayerIdsOrdered.set([]);
    }
  }

  private saveStateToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: PersistedScaleToolsState = {
      selectedLayerIdsOrdered: this.selectedLayerIdsOrdered(),
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors.
    }
  }
}
