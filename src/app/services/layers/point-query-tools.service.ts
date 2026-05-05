import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { EMPTY, Observable, Subject, Subscription, finalize, forkJoin, map, switchMap } from 'rxjs';

import {
  ABIGoesTileLayer,
  EcmwfTpLayerControls,
  EcmwfTpTileLayer,
  GLMGoesTileLayer,
  GoesLayerControls,
  LayerCategory,
  LayerType,
  PointQueryDisplayData,
  RadarLayerControls,
  RadarTileLayer,
  TileLayerControls,
} from '../../models';
import { STORAGE_KEYS } from '../../constants';
import { LayerControlService } from './layer-control.service';
import { LayersService } from './layers.service';
import { PointQueryService, buildSecondaryLayerId } from './point-query.service';
import { MapInfoService } from './map-info.service';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';
import { formatEcmwfForecastTs } from '../../utils/tileset-timestamp';

interface MouseCoordinates {
  lat: number;
  lon: number;
}

type DisplaySourceItem = {
  layerId: string;
  elevationId?: string;
  forecastTs?: string;
  layerName: string;
  layer: ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer | EcmwfTpTileLayer;
  controls: TileLayerControls;
};

interface PointQueryViewerEntry {
  layerId: string;
  layerName: string;
  data: PointQueryDisplayData | null;
  isLoading: boolean;
}

interface PersistedPointQueryViewerState {
  enabled: boolean;
  selectedLayerIdsOrdered: string[];
  showMarker: boolean;
}

interface SourceQueryResult {
  layerId: string;
  result: PointQueryDisplayData;
}

/** Helper to create composite IDs from a layer id and a sub-key (elevation or forecast). */
function createCompositeId(layerId: string, subKey: string): string {
  return `${layerId}:${subKey}`;
}

@Injectable({
  providedIn: 'root',
})
export class PointQueryViewerService {
  private readonly controlService = inject(LayerControlService);
  private readonly layersService = inject(LayersService);
  private readonly pointQueryService = inject(PointQueryService);
  private readonly mapInfoService = inject(MapInfoService);
  private readonly polygonDrawingService = inject(PolygonDrawingService);

  private readonly subscriptions = new Subscription();
  private readonly queryTriggerSubject = new Subject<MouseCoordinates>();
  private initialized = false;

  readonly enabled = signal<boolean>(false);
  readonly selectedLayerIdsOrdered = signal<string[]>([]);
  readonly lastClickCoordinates = signal<MouseCoordinates | null>(null);
  readonly showMarker = signal<boolean>(true);
  readonly isPaused = signal<boolean>(false);

  // Current marker position (for rendering on map)
  readonly markerPosition = computed<MouseCoordinates | null>(() => {
    if (!this.showMarker() || !this.enabled()) {
      return null;
    }
    return this.lastClickCoordinates();
  });

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

    const ecmwfItems: DisplaySourceItem[] = activeLayers
      .filter(
        ({ layer }) => layer.type === LayerType.TILE && layer.category === LayerCategory.ECMWF_TP,
      )
      .flatMap(({ layer, controls }): DisplaySourceItem[] => {
        const ecmwfLayer = layer as EcmwfTpTileLayer;
        const ecmwfControls = controls as EcmwfTpLayerControls;
        const selectedForecasts = ecmwfControls.forecast.selectedForecastTimestamps;
        const baseName = this.layersService.getLayerFullName(ecmwfLayer);

        return selectedForecasts.map((forecastTs) => ({
          layerId: createCompositeId(layer.id, forecastTs),
          layerName: `${baseName} — ${formatEcmwfForecastTs(forecastTs)}`,
          forecastTs,
          layer: ecmwfLayer,
          controls: ecmwfControls,
        }));
      });

    return [...satelliteItems, ...radarItems, ...ecmwfItems];
  });

  readonly floatingViewerEntries = computed<PointQueryViewerEntry[]>(() => {
    const selectedEntries = this.getSelectedDisplayItems();
    const results = this.resultsBySource();
    const loadingIds = this.loadingLayerIds();

    return selectedEntries.flatMap((entry): PointQueryViewerEntry[] => {
      const showMovingState = entry.controls.playback.isPlaying;

      const primary: PointQueryViewerEntry = {
        layerId: entry.layerId,
        layerName: entry.layerName,
        data: results.get(entry.layerId) ?? null,
        isLoading: loadingIds.has(entry.layerId) || showMovingState,
      };

      // Layers with a secondary vector overlay (e.g. ECMWF TP + MSLP isobars)
      // emit a paired card with the secondary value (presión).
      const secondary = this.getSecondaryRender(entry.layer);
      if (!secondary?.buildPointQueryUrl) {
        return [primary];
      }
      const secondaryLayerId = buildSecondaryLayerId(entry.layerId);
      const secondaryLayerName = entry.forecastTs
        ? `Presión a nivel del mar — ${formatEcmwfForecastTs(entry.forecastTs)}`
        : 'Presión a nivel del mar';
      const secondaryEntry: PointQueryViewerEntry = {
        layerId: secondaryLayerId,
        layerName: secondaryLayerName,
        data: results.get(secondaryLayerId) ?? null,
        isLoading: loadingIds.has(secondaryLayerId) || showMovingState,
      };
      return [primary, secondaryEntry];
    });
  });

  private getSecondaryRender(layer: DisplaySourceItem['layer']) {
    if (layer.type !== LayerType.TILE) return undefined;
    if (layer.category !== LayerCategory.ECMWF_TP) return undefined;
    return (layer as EcmwfTpTileLayer).secondaryRender;
  }

  constructor() {
    this.loadStateFromStorage();
    this.loadResultsFromStorage();

    effect(() => {
      // Persist minimal configuration state.
      this.saveStateToStorage();
    });

    effect(() => {
      // Persist query results to restore on reload.
      this.saveResultsToStorage();
    });

    effect(() => {
      // When active layers change, keep only selected layer IDs that still exist.
      // Auto-select newly activated layers, but keep the tool itself disabled by default.
      const allItems = this.displayItems();
      const allLayerIds = new Set(allItems.map((item) => item.layerId));

      const currentSelection = this.selectedLayerIdsOrdered();
      const filteredSelection = currentSelection.filter((layerId) => allLayerIds.has(layerId));
      const newLayerIds = allItems
        .map((item) => item.layerId)
        .filter((layerId) => !currentSelection.includes(layerId));

      const updatedSelection = [...filteredSelection, ...newLayerIds];

      if (
        updatedSelection.length !== currentSelection.length ||
        !updatedSelection.every((id, i) => currentSelection[i] === id)
      ) {
        this.selectedLayerIdsOrdered.set(updatedSelection);

        // Clean up results and loading states for removed layers
        const updatedSelectionSet = new Set(updatedSelection);
        const currentResults = this.resultsBySource();
        const currentLoading = this.loadingLayerIds();

        // Remove results for deselected layers
        const nextResults = new Map(currentResults);
        let resultsChanged = false;
        for (const layerId of currentResults.keys()) {
          if (!updatedSelectionSet.has(layerId)) {
            nextResults.delete(layerId);
            resultsChanged = true;
          }
        }
        if (resultsChanged) {
          this.resultsBySource.set(nextResults);
        }

        // Remove loading states for deselected layers
        const nextLoading = new Set(currentLoading);
        let loadingChanged = false;
        for (const layerId of currentLoading) {
          if (!updatedSelectionSet.has(layerId)) {
            nextLoading.delete(layerId);
            loadingChanged = true;
          }
        }
        if (loadingChanged) {
          this.loadingLayerIds.set(nextLoading);
        }
      }
    });

    effect(() => {
      if (this.canRunQueries()) {
        return;
      }

      this.loadingLayerIds.set(new Set());
    });

    effect(() => {
      const mode = this.polygonDrawingService.drawingMode();

      // Skip if not yet initialized to avoid race conditions with polygon drawing
      if (!this.initialized) {
        return;
      }

      if (mode === DrawingMode.DRAW || mode === DrawingMode.EDIT) {
        // Pause queries while drawing/editing - keep enabled flag for UI, show previous results
        this.isPaused.set(true);
      } else {
        // Resume when done drawing/editing
        this.isPaused.set(false);
      }
    });

    // Sync marker position with MapInfoService for rendering
    effect(() => {
      const position = this.markerPosition();
      this.mapInfoService.setQueryMarkerPosition(position);
    });
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

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

            const loadingIds = new Set<string>();
            for (const entry of selectedEntries) {
              loadingIds.add(entry.layerId);
              const secondary = this.getSecondaryRender(entry.layer);
              if (secondary?.buildPointQueryUrl) {
                loadingIds.add(buildSecondaryLayerId(entry.layerId));
              }
            }
            this.loadingLayerIds.set(loadingIds);

            const requests: Array<Observable<SourceQueryResult>> = [];
            for (const { layerId, layer, controls, elevationId, forecastTs } of selectedEntries) {
              const primary$ = this.pointQueryService
                .queryLayerPoint(
                  layer,
                  controls,
                  coordinates.lat,
                  coordinates.lon,
                  elevationId,
                  forecastTs,
                )
                .pipe(map((result): SourceQueryResult => ({ layerId, result })));
              requests.push(primary$);

              const secondary$ = this.pointQueryService.queryLayerSecondaryPoint(
                layer,
                controls,
                coordinates.lat,
                coordinates.lon,
                forecastTs,
              );
              if (secondary$) {
                const secondaryLayerId = buildSecondaryLayerId(layerId);
                requests.push(
                  secondary$.pipe(
                    map((result): SourceQueryResult => ({ layerId: secondaryLayerId, result })),
                  ),
                );
              }
            }

            return forkJoin(requests).pipe(finalize(() => this.loadingLayerIds.set(new Set())));
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

  handleMapClick(lat: number, lon: number, button: number): void {
    if (
      button !== 0 ||
      this.isPaused() ||
      this.polygonDrawingService.drawingMode() !== DrawingMode.NONE
    ) {
      return;
    }

    const coordinates = { lat, lon };
    this.lastClickCoordinates.set(coordinates);

    if (!this.canRunQueries()) {
      return;
    }

    this.queryTriggerSubject.next(coordinates);
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
  }

  toggleMarker(enabled: boolean): void {
    this.showMarker.set(enabled);
  }

  toggleSourceSelection(layerId: string, checked: boolean): void {
    const currentSelection = this.selectedLayerIdsOrdered();

    if (checked) {
      if (currentSelection.includes(layerId)) {
        return;
      }

      this.selectedLayerIdsOrdered.set([...currentSelection, layerId]);

      if (!this.enabled()) {
        this.enabled.set(true);
      }

      return;
    }

    this.removeSourceSelection(layerId);
  }

  removeSourceSelection(layerId: string): void {
    const currentSelection = this.selectedLayerIdsOrdered();

    // Remove from selection if present
    if (currentSelection.includes(layerId)) {
      this.selectedLayerIdsOrdered.set(currentSelection.filter((id) => id !== layerId));
    }

    // Always clean results and loading states
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
      this.enabled() &&
      !this.isPaused() &&
      this.selectedLayerIdsOrdered().length > 0 &&
      this.polygonDrawingService.drawingMode() === DrawingMode.NONE
    );
  }

  private disableViewerAndClearSources(): void {
    if (!this.enabled() && this.selectedLayerIdsOrdered().length === 0) {
      return;
    }

    this.enabled.set(false);
    this.clearSelectedSources();
  }

  private loadStateFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.POINT_QUERY_VIEWER);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedPointQueryViewerState;

      this.enabled.set(parsed.enabled ?? false);
      this.selectedLayerIdsOrdered.set(parsed.selectedLayerIdsOrdered ?? []);
      this.showMarker.set(parsed.showMarker ?? false);
    } catch (error) {
      console.warn('Failed to load point query viewer state from localStorage:', error);
    }
  }

  private saveStateToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: PersistedPointQueryViewerState = {
      enabled: this.enabled(),
      selectedLayerIdsOrdered: this.selectedLayerIdsOrdered(),
      showMarker: this.showMarker(),
    };

    try {
      localStorage.setItem(STORAGE_KEYS.POINT_QUERY_VIEWER, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save point query viewer state to localStorage:', error);
    }
  }

  private loadResultsFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.POINT_QUERY_RESULTS);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const nextResults = new Map<string, PointQueryDisplayData>();
      for (const [layerId, result] of Object.entries(parsed)) {
        // Basic validation that result has expected shape
        if (result && typeof result === 'object' && 'status' in result) {
          nextResults.set(layerId, result as PointQueryDisplayData);
        }
      }

      if (nextResults.size > 0) {
        this.resultsBySource.set(nextResults);
      }
    } catch (error) {
      console.warn('Failed to load point query results from localStorage:', error);
    }
  }

  private saveResultsToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const results = this.resultsBySource();
    if (results.size === 0) {
      try {
        localStorage.removeItem(STORAGE_KEYS.POINT_QUERY_RESULTS);
      } catch {
        // Ignore remove errors
      }
      return;
    }

    try {
      const payload: Record<string, PointQueryDisplayData> = Object.fromEntries(results);
      localStorage.setItem(STORAGE_KEYS.POINT_QUERY_RESULTS, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save point query results to localStorage:', error);
    }
  }
}
