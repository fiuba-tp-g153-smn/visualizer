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
  Layer,
  LayerCategory,
  LayerType,
  PointQueryDisplayData,
  TileLayerControls,
} from '../../models';
import { LayerControlService } from './layer-control.service';
import { PointQueryService } from './point-query.service';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';

interface MouseCoordinates {
  lat: number;
  lon: number;
}

interface ActiveDataLayerEntry {
  layer: Layer;
  controls: TileLayerControls;
}

interface PersistedPointQueryViewerState {
  isViewerEnabled: boolean;
  interactionMode: PointQueryInteractionMode;
  selectedSourceIdsOrdered: string[];
}

interface SourceQueryResult {
  sourceId: string;
  result: PointQueryDisplayData;
}

export interface PointQueryViewerEntry {
  layerId: string;
  layerName: string;
  data: PointQueryDisplayData | null;
  isLoading: boolean;
}

export type PointQueryInteractionMode = 'off' | 'manual' | 'automatic';

@Injectable({
  providedIn: 'root',
})
export class PointQueryViewerService {
  private readonly STORAGE_KEY = 'smn-point-query-viewer-v3';

  private readonly controlService = inject(LayerControlService);
  private readonly pointQueryService = inject(PointQueryService);
  private readonly polygonDrawingService = inject(PolygonDrawingService);

  private readonly subscriptions = new Subscription();
  private readonly mouseMoveSubject = new Subject<MouseCoordinates>();
  private readonly queryTriggerSubject = new Subject<MouseCoordinates>();
  private initialized = false;

  readonly isViewerEnabled = signal<boolean>(false);
  readonly interactionMode = signal<PointQueryInteractionMode>('off');
  readonly selectedSourceIdsOrdered = signal<string[]>([]);
  readonly isPointerMoving = signal<boolean>(false);
  readonly lastMouseCoordinates = signal<MouseCoordinates | null>(null);
  readonly lastClickCoordinates = signal<MouseCoordinates | null>(null);

  private readonly resultsBySource = signal<Map<string, PointQueryDisplayData>>(new Map());
  private readonly loadingSourceIds = signal<Set<string>>(new Set());

  readonly activeDataLayers = computed<ActiveDataLayerEntry[]>(() => {
    return this.controlService
      .activeLayers()
      .filter(
        ({ layer }) =>
          layer.type === LayerType.TILE &&
          (layer.category === LayerCategory.GOES_19 || layer.category === LayerCategory.RADAR),
      )
      .map(({ layer, controls }) => ({
        layer,
        controls: controls as TileLayerControls,
      }));
  });

  readonly selectedSourceEntries = computed<ActiveDataLayerEntry[]>(() => {
    const activeById = new Map(this.activeDataLayers().map((entry) => [entry.layer.id, entry]));

    return this.selectedSourceIdsOrdered()
      .map((sourceId) => activeById.get(sourceId) ?? null)
      .filter((entry): entry is ActiveDataLayerEntry => entry !== null);
  });

  readonly shouldRunQueries = computed<boolean>(() => {
    return (
      this.interactionMode() !== 'off' &&
      this.selectedSourceIdsOrdered().length > 0 &&
      this.polygonDrawingService.drawingMode() === DrawingMode.NONE
    );
  });

  readonly floatingViewerEntries = computed<PointQueryViewerEntry[]>(() => {
    const selectedEntries = this.selectedSourceEntries();
    const results = this.resultsBySource();
    const loadingIds = this.loadingSourceIds();
    const showMovingState = this.interactionMode() === 'automatic' && this.isPointerMoving();

    return selectedEntries.map((entry) => ({
      layerId: entry.layer.id,
      layerName: entry.layer.name,
      data: results.get(entry.layer.id) ?? null,
      isLoading: loadingIds.has(entry.layer.id) || showMovingState,
    }));
  });

  constructor() {
    this.loadStateFromStorage();

    effect(() => {
      // Persist minimal configuration state.
      this.saveStateToStorage();
    });

    effect(() => {
      const activeIds = new Set(this.activeDataLayers().map((entry) => entry.layer.id));
      const currentSelection = this.selectedSourceIdsOrdered();
      const filteredSelection = currentSelection.filter((sourceId) => activeIds.has(sourceId));

      if (filteredSelection.length !== currentSelection.length) {
        this.selectedSourceIdsOrdered.set(filteredSelection);
      }
    });

    effect(() => {
      if (this.shouldRunQueries()) {
        return;
      }

      this.isPointerMoving.set(false);
      this.loadingSourceIds.set(new Set());
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

        if (this.interactionMode() === 'automatic' && this.shouldRunQueries()) {
          this.queryTriggerSubject.next(coordinates);
        }
      }),
    );

    this.subscriptions.add(
      this.queryTriggerSubject
        .pipe(
          switchMap((coordinates) => {
            if (!this.shouldRunQueries()) {
              this.loadingSourceIds.set(new Set());
              return EMPTY;
            }

            const selectedEntries = this.selectedSourceEntries();
            if (selectedEntries.length === 0) {
              this.loadingSourceIds.set(new Set());
              return EMPTY;
            }

            const sourceIds = selectedEntries.map((entry) => entry.layer.id);
            this.loadingSourceIds.set(new Set(sourceIds));

            return forkJoin(
              selectedEntries.map(({ layer, controls }) =>
                this.pointQueryService
                  .queryLayerPoint(layer, controls, coordinates.lat, coordinates.lon)
                  .pipe(
                    map(
                      (result): SourceQueryResult => ({
                        sourceId: layer.id,
                        result,
                      }),
                    ),
                  ),
              ),
            ).pipe(finalize(() => this.loadingSourceIds.set(new Set())));
          }),
        )
        .subscribe((results) => {
          const nextResults = new Map(this.resultsBySource());
          for (const item of results) {
            nextResults.set(item.sourceId, item.result);
          }
          this.resultsBySource.set(nextResults);
        }),
    );
  }

  handleMouseMove(lat: number, lon: number): void {
    if (!this.shouldRunQueries() || this.interactionMode() !== 'automatic') {
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

    if (!this.shouldRunQueries() || this.interactionMode() !== 'manual') {
      return;
    }

    this.queryTriggerSubject.next(coordinates);
  }

  setViewerEnabled(enabled: boolean): void {
    this.isViewerEnabled.set(enabled);

    if (!enabled) {
      this.isPointerMoving.set(false);
      this.loadingSourceIds.set(new Set());
    }
  }

  setInteractionMode(mode: PointQueryInteractionMode): void {
    this.interactionMode.set(mode);
    this.isPointerMoving.set(false);

    if (mode === 'off') {
      this.isViewerEnabled.set(false);
    } else {
      this.isViewerEnabled.set(true);
    }
  }

  toggleSourceSelection(sourceId: string, checked: boolean): void {
    const currentSelection = this.selectedSourceIdsOrdered();

    if (checked) {
      if (currentSelection.includes(sourceId)) {
        return;
      }
      this.selectedSourceIdsOrdered.set([...currentSelection, sourceId]);
      return;
    }

    this.removeSourceSelection(sourceId);
  }

  removeSourceSelection(sourceId: string): void {
    const currentSelection = this.selectedSourceIdsOrdered();
    if (!currentSelection.includes(sourceId)) {
      return;
    }

    this.selectedSourceIdsOrdered.set(currentSelection.filter((id) => id !== sourceId));

    const nextResults = new Map(this.resultsBySource());
    nextResults.delete(sourceId);
    this.resultsBySource.set(nextResults);

    const nextLoading = new Set(this.loadingSourceIds());
    nextLoading.delete(sourceId);
    this.loadingSourceIds.set(nextLoading);
  }

  clearSelectedSources(): void {
    this.selectedSourceIdsOrdered.set([]);
    this.resultsBySource.set(new Map());
    this.loadingSourceIds.set(new Set());
  }

  isSourceSelected(sourceId: string): boolean {
    return this.selectedSourceIdsOrdered().includes(sourceId);
  }

  private disableViewerAndClearSources(): void {
    if (this.interactionMode() === 'off' && this.selectedSourceIdsOrdered().length === 0) {
      return;
    }

    this.interactionMode.set('off');
    this.isViewerEnabled.set(false);
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

      if (typeof parsed.isViewerEnabled === 'boolean') {
        this.isViewerEnabled.set(parsed.isViewerEnabled);
      }

      if (parsed.interactionMode === 'off' || parsed.interactionMode === 'manual' || parsed.interactionMode === 'automatic') {
        this.interactionMode.set(parsed.interactionMode);
        if (parsed.interactionMode === 'off') {
          this.isViewerEnabled.set(false);
        } else {
          this.isViewerEnabled.set(true);
        }
      }

      if (Array.isArray(parsed.selectedSourceIdsOrdered)) {
        this.selectedSourceIdsOrdered.set(
          parsed.selectedSourceIdsOrdered.filter(
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
      isViewerEnabled: this.isViewerEnabled(),
      interactionMode: this.interactionMode(),
      selectedSourceIdsOrdered: this.selectedSourceIdsOrdered(),
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save point query viewer state to localStorage:', error);
    }
  }
}
