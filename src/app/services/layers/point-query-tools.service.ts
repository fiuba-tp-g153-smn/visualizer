import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  EMPTY,
  Subject,
  Subscription,
  debounceTime,
  finalize,
  forkJoin,
  map,
  switchMap,
} from 'rxjs';

import {
  ABIGoesTileLayer,
  GLMGoesTileLayer,
  GoesLayerControls,
  LayerCategory,
  LayerType,
  PointQueryDisplayData,
  PointQueryInteractionMode,
  RadarLayerControls,
  RadarTileLayer,
  TileLayerControls,
} from '../../models';
import { LayerControlService } from './layer-control.service';
import { LayersService } from './layers.service';
import { PointQueryService } from './point-query.service';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';

interface MouseCoordinates {
  lat: number;
  lon: number;
}

type DisplaySourceItem = {
  layerId: string;
  elevationId?: string;
  layerName: string;
  layer: ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer;
  controls: TileLayerControls;
};

interface PointQueryViewerEntry {
  layerId: string;
  layerName: string;
  data: PointQueryDisplayData | null;
  isLoading: boolean;
}

interface PersistedPointQueryViewerState {
  interactionMode: PointQueryInteractionMode;
  selectedLayerIdsOrdered: string[];
}

interface SourceQueryResult {
  layerId: string;
  result: PointQueryDisplayData;
}

/** Helper to create composite IDs from layerId and elevationId */
function createCompositeId(layerId: string, elevationId: string): string {
  return `${layerId}:${elevationId}`;
}

@Injectable({
  providedIn: 'root',
})
export class PointQueryViewerService {
  private readonly STORAGE_KEY = 'smn-point-query-viewer-v4';

  private readonly controlService = inject(LayerControlService);
  private readonly layersService = inject(LayersService);
  private readonly pointQueryService = inject(PointQueryService);
  private readonly polygonDrawingService = inject(PolygonDrawingService);

  private readonly subscriptions = new Subscription();
  private readonly mouseMoveSubject = new Subject<MouseCoordinates>();
  private readonly queryTriggerSubject = new Subject<MouseCoordinates>();
  private initialized = false;

  readonly interactionMode = signal<PointQueryInteractionMode>(PointQueryInteractionMode.OFF);
  readonly isViewerEnabled = computed<boolean>(
    () => this.interactionMode() !== PointQueryInteractionMode.OFF,
  );
  readonly selectedLayerIdsOrdered = signal<string[]>([]);
  readonly isPointerMoving = signal<boolean>(false);
  readonly lastMouseCoordinates = signal<MouseCoordinates | null>(null);
  readonly lastClickCoordinates = signal<MouseCoordinates | null>(null);

  private readonly resultsBySource = signal<Map<string, PointQueryDisplayData>>(new Map());
  private readonly loadingLayerIds = signal<Set<string>>(new Set());

  readonly displayItems = computed<DisplaySourceItem[]>(() => {
    const activeLayers = this.controlService.activeLayers();

    const satelliteItems: DisplaySourceItem[] = activeLayers
      .filter(
        ({ layer }) => layer.type === LayerType.TILE && layer.category === LayerCategory.GOES_19,
      )
      .map(({ layer, controls }) => ({
        layerId: layer.id,
        layerName: this.layersService.getLayerFullName(layer),
        layer: layer as ABIGoesTileLayer | GLMGoesTileLayer,
        controls: controls as GoesLayerControls,
      }));

    const radarItems: DisplaySourceItem[] = activeLayers
      .filter(
        ({ layer }) => layer.type === LayerType.TILE && layer.category === LayerCategory.RADAR,
      )
      .flatMap(({ layer, controls }): DisplaySourceItem[] => {
        const radarLayer = layer as RadarTileLayer;
        const radarControls = controls as RadarLayerControls;
        const selectedElevations = radarControls.elevation.selectedElevationIds;

        return selectedElevations.map((elevationId) => ({
          layerId: createCompositeId(layer.id, elevationId),
          layerName: this.layersService.getLayerFullName(radarLayer, elevationId),
          elevationId,
          layer: radarLayer,
          controls: radarControls,
        }));
      });

    return [...satelliteItems, ...radarItems];
  });

  readonly floatingViewerEntries = computed<PointQueryViewerEntry[]>(() => {
    const selectedEntries = this.getSelectedDisplayItems();
    const results = this.resultsBySource();
    const loadingIds = this.loadingLayerIds();
    const showMovingState =
      this.interactionMode() === PointQueryInteractionMode.AUTOMATIC && this.isPointerMoving();

    return selectedEntries.map((entry) => {
      const result = results.get(entry.layerId);
      return {
        layerId: entry.layerId,
        layerName: this.layersService.getLayerFullName(entry.layer, entry.elevationId),
        data: result ?? null,
        isLoading: loadingIds.has(entry.layerId) || showMovingState,
      };
    });
  });

  constructor() {
    this.loadStateFromStorage();

    effect(() => {
      // Persist minimal configuration state.
      this.saveStateToStorage();
    });

    effect(() => {
      // When active layers change, keep only selected layer IDs that still exist.
      const allLayerIds = new Set(this.displayItems().map((item) => item.layerId));

      const currentSelection = this.selectedLayerIdsOrdered();
      const filteredSelection = currentSelection.filter((layerId) => allLayerIds.has(layerId));

      if (filteredSelection.length !== currentSelection.length) {
        this.selectedLayerIdsOrdered.set(filteredSelection);
      }
    });

    effect(() => {
      if (this.canRunQueries()) {
        return;
      }

      this.isPointerMoving.set(false);
      this.loadingLayerIds.set(new Set());
    });

    effect(() => {
      const mode = this.polygonDrawingService.drawingMode();

      if (mode === DrawingMode.DRAW || mode === DrawingMode.EDIT) {
        this.disableViewerAndClearSources();
      }
    });
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.subscriptions.add(
      this.mouseMoveSubject.pipe(debounceTime(400)).subscribe((coordinates) => {
        this.isPointerMoving.set(false);
        this.lastMouseCoordinates.set(coordinates);

        if (
          this.interactionMode() === PointQueryInteractionMode.AUTOMATIC &&
          this.canRunQueries()
        ) {
          this.queryTriggerSubject.next(coordinates);
        }
      }),
    );

    this.subscriptions.add(
      this.queryTriggerSubject
        .pipe(
          switchMap((coordinates) => {
            if (!this.canRunQueries()) {
              this.loadingLayerIds.set(new Set());
              return EMPTY;
            }

            const selectedEntries = this.getSelectedDisplayItems();
            if (selectedEntries.length === 0) {
              this.loadingLayerIds.set(new Set());
              return EMPTY;
            }

            const layerIds = selectedEntries.map((entry) => entry.layerId);
            this.loadingLayerIds.set(new Set(layerIds));

            return forkJoin(
              selectedEntries.map(({ layerId, layer, controls, elevationId }) =>
                this.pointQueryService
                  .queryLayerPoint(layer, controls, coordinates.lat, coordinates.lon, elevationId)
                  .pipe(
                    map(
                      (result): SourceQueryResult => ({
                        layerId,
                        result,
                      }),
                    ),
                  ),
              ),
            ).pipe(finalize(() => this.loadingLayerIds.set(new Set())));
          }),
        )
        .subscribe((results) => {
          const nextResults = new Map(this.resultsBySource());
          for (const item of results) {
            nextResults.set(item.layerId, item.result);
          }
          this.resultsBySource.set(nextResults);
        }),
    );
  }

  handleMouseMove(lat: number, lon: number): void {
    if (!this.canRunQueries() || this.interactionMode() !== PointQueryInteractionMode.AUTOMATIC) {
      this.isPointerMoving.set(false);
      return;
    }

    this.isPointerMoving.set(true);
    this.mouseMoveSubject.next({ lat, lon });
  }

  handleMapClick(lat: number, lon: number, button: number): void {
    if (button !== 0) {
      return;
    }

    const coordinates = { lat, lon };
    this.lastClickCoordinates.set(coordinates);

    if (!this.canRunQueries() || this.interactionMode() !== PointQueryInteractionMode.MANUAL) {
      return;
    }

    this.queryTriggerSubject.next(coordinates);
  }

  setInteractionMode(mode: PointQueryInteractionMode): void {
    this.interactionMode.set(mode);
    this.isPointerMoving.set(false);
  }

  toggleSourceSelection(layerId: string, checked: boolean): void {
    const currentSelection = this.selectedLayerIdsOrdered();

    if (checked) {
      if (currentSelection.includes(layerId)) {
        return;
      }
      this.selectedLayerIdsOrdered.set([...currentSelection, layerId]);
      return;
    }

    this.removeSourceSelection(layerId);
  }

  removeSourceSelection(layerId: string): void {
    const currentSelection = this.selectedLayerIdsOrdered();
    if (!currentSelection.includes(layerId)) {
      return;
    }

    this.selectedLayerIdsOrdered.set(currentSelection.filter((id) => id !== layerId));

    const nextResults = new Map(this.resultsBySource());
    nextResults.delete(layerId);
    this.resultsBySource.set(nextResults);

    const nextLoading = new Set(this.loadingLayerIds());
    nextLoading.delete(layerId);
    this.loadingLayerIds.set(nextLoading);
  }

  clearSelectedSources(): void {
    this.selectedLayerIdsOrdered.set([]);
    this.resultsBySource.set(new Map());
    this.loadingLayerIds.set(new Set());
  }

  isSourceSelected(layerId: string): boolean {
    return this.selectedLayerIdsOrdered().includes(layerId);
  }

  private getSelectedDisplayItems(): DisplaySourceItem[] {
    const sourceMap = new Map<string, DisplaySourceItem>(
      this.displayItems().map((item) => [item.layerId, item]),
    );

    return this.selectedLayerIdsOrdered()
      .map((layerId) => sourceMap.get(layerId) ?? null)
      .filter((entry): entry is DisplaySourceItem => entry !== null);
  }

  private canRunQueries(): boolean {
    return (
      this.interactionMode() !== PointQueryInteractionMode.OFF &&
      this.selectedLayerIdsOrdered().length > 0 &&
      this.polygonDrawingService.drawingMode() === DrawingMode.NONE
    );
  }

  private disableViewerAndClearSources(): void {
    if (
      this.interactionMode() === PointQueryInteractionMode.OFF &&
      this.selectedLayerIdsOrdered().length === 0
    ) {
      return;
    }

    this.interactionMode.set(PointQueryInteractionMode.OFF);
    this.clearSelectedSources();
    this.isPointerMoving.set(false);
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

      const parsed = JSON.parse(raw) as Partial<PersistedPointQueryViewerState>;

      if (
        parsed.interactionMode === PointQueryInteractionMode.OFF ||
        parsed.interactionMode === PointQueryInteractionMode.MANUAL ||
        parsed.interactionMode === PointQueryInteractionMode.AUTOMATIC
      ) {
        this.interactionMode.set(parsed.interactionMode);
      }

      if (Array.isArray(parsed.selectedLayerIdsOrdered)) {
        this.selectedLayerIdsOrdered.set(
          parsed.selectedLayerIdsOrdered.filter(
            (value): value is string => typeof value === 'string',
          ),
        );
      }
    } catch (error) {
      console.warn('Failed to load point query viewer state from localStorage:', error);
    }
  }

  private saveStateToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: PersistedPointQueryViewerState = {
      interactionMode: this.interactionMode(),
      selectedLayerIdsOrdered: this.selectedLayerIdsOrdered(),
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save point query viewer state to localStorage:', error);
    }
  }
}
