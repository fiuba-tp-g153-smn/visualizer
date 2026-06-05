import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';

import {
  ABIGoesTileLayer,
  EcmwfTpLayerControls,
  EcmwfTpTileLayerConfig,
  EcmwfTpTileLayer,
  GLMGoesTileLayer,
  GoesTileLayer,
  GoesLayerControls,
  LayerScale,
  Layer,
  LayerCategory,
  LayerType,
  PointQueryDisplayData,
  PointQueryStatus,
  PointQueryValueDto,
  RadarLayerControls,
  RadarTileLayer,
  ScaleRangeInfo,
  ScaleType,
  TileLayerControls,
  WrfLayerControls,
  WrfSecondaryPointQuery,
  WrfTileLayer,
  WrfTileLayerConfig,
} from '../../models';
import { PRIMARY_RENDER_ID } from '../../models/layers/controls.models';
import { STORAGE_KEYS } from '../../constants';
import { LayerControlService } from '../layers/layer-control.service';
import { LayerConfigService } from '../layers/layer-config.service';
import { LayersService } from '../layers/layers.service';
import { MapInfoService } from '../layers/map-info.service';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';
import { getDefaultCursorIndex } from '../../utils/playback-window';
import {
  buildEcmwfTpPointQueryUrl,
  buildRadarPointQueryUrl,
  buildSatellitePointQueryUrl,
} from '../../config';
import { buildWrfPointQueryUrl, buildWrfSecondaryPointQueryUrl } from '../../config/backend.config';
import {
  formatDateFull,
  parseEcmwfTimestamp,
  formatWrfInitTag,
  wrfFxxxForInitAndTime,
} from '../../utils/tileset-timestamp';

interface MouseCoordinates {
  lat: number;
  lon: number;
}

/**
 * Margen (en grados) agregado al bounding box para consultas puntuales.
 * Evita descartar clicks válidos cerca de los bordes de grids proyectados
 * (como WRF). Si el punto está fuera del dominio, el backend responde no-data.
 */
const POINT_QUERY_BOUNDS_MARGIN_DEG = 8;

export const POINT_QUERY_PANEL_MODES = {
  FIXED: 'fixed',
  NEAR_MARKER: 'near-marker',
} as const;

export type PointQueryPanelMode =
  (typeof POINT_QUERY_PANEL_MODES)[keyof typeof POINT_QUERY_PANEL_MODES];

type DisplaySourceKind = 'primary' | 'secondary';

type DisplaySourceItem = {
  layerId: string;
  sourceKind: DisplaySourceKind;
  elevationId?: string;
  forecastTs?: string;
  secondaryRenderId?: string;
  layerName: string;
  layer: ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer | EcmwfTpTileLayer | WrfTileLayer;
  controls: TileLayerControls;
  /** Metadata de la variable secundaria WRF (presente solo en items WRF secondary). */
  secondary?: WrfSecondaryPointQuery;
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
  manuallyDeselectedLayerIds?: string[];
  showMarker: boolean;
  panelMode?: PointQueryPanelMode;
}

interface SourceQueryResult {
  layerId: string;
  result: PointQueryDisplayData;
}

const SECONDARY_LAYER_ID_SUFFIX = '#secondary';

function buildSecondaryLayerId(layerId: string): string {
  return `${layerId}${SECONDARY_LAYER_ID_SUFFIX}`;
}

/** Helper to create composite IDs from a layer id and a sub-key (elevation or forecast). */
function createCompositeId(layerId: string, subKey: string): string {
  return `${layerId}:${subKey}`;
}

@Injectable({
  providedIn: 'root',
})
export class PointQueryViewerService {
  private readonly http = inject(HttpClient);
  private readonly controlService = inject(LayerControlService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly layersService = inject(LayersService);
  private readonly mapInfoService = inject(MapInfoService);
  private readonly polygonDrawingService = inject(PolygonDrawingService);

  private readonly subscriptions = new Subscription();
  private readonly queryTriggerSubject = new Subject<MouseCoordinates>();
  private initialized = false;
  private restoredSelectionFromStorage = false;
  private hasSyncedDisplayItems = false;

  readonly enabled = signal<boolean>(false);
  readonly selectedLayerIdsOrdered = signal<string[]>([]);
  readonly manuallyDeselectedLayerIds = signal<Set<string>>(new Set());
  readonly lastClickCoordinates = signal<MouseCoordinates | null>(null);
  readonly showMarker = signal<boolean>(true);
  readonly panelMode = signal<PointQueryPanelMode>(POINT_QUERY_PANEL_MODES.FIXED);
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
        sourceKind: 'primary' as const,
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
          sourceKind: 'primary' as const,
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
        const modelName = baseName.split(' - ')[0] || 'ECMWF';
        const secondaryRender = this.getSecondaryRender(ecmwfLayer);

        return selectedForecasts.flatMap((forecastTs): DisplaySourceItem[] => {
          const primaryLayerId = createCompositeId(layer.id, forecastTs);
          const forecastDate = parseEcmwfTimestamp(forecastTs);
          const forecastLabel = forecastDate ? formatDateFull(forecastDate) : forecastTs;

          const entries: DisplaySourceItem[] = [];

          if (this.isForecastRenderVisible(ecmwfControls, forecastTs, PRIMARY_RENDER_ID)) {
            entries.push({
              layerId: primaryLayerId,
              sourceKind: 'primary',
              layerName: `${baseName} - corrida ${forecastLabel}`,
              forecastTs,
              layer: ecmwfLayer,
              controls: ecmwfControls,
            });
          }

          if (
            secondaryRender?.buildPointQueryUrl &&
            this.isForecastRenderVisible(ecmwfControls, forecastTs, secondaryRender.id)
          ) {
            entries.push({
              layerId: buildSecondaryLayerId(primaryLayerId),
              sourceKind: 'secondary',
              layerName: `${modelName} - Presion a nivel del mar - corrida ${forecastLabel}`,
              forecastTs,
              secondaryRenderId: secondaryRender.id,
              layer: ecmwfLayer,
              controls: ecmwfControls,
            });
          }

          return entries;
        });
      });

    const wrfItems: DisplaySourceItem[] = activeLayers
      .filter(({ layer }) => layer.type === LayerType.TILE && layer.category === LayerCategory.WRF)
      .flatMap(({ layer, controls }): DisplaySourceItem[] => {
        const wrfLayer = layer as WrfTileLayer;
        const wrfControls = controls as WrfLayerControls;
        const selectedForecasts = wrfControls.forecast.selectedForecastTimestamps;
        const baseName = this.layersService.getLayerFullName(wrfLayer);

        return selectedForecasts.flatMap((forecastTs): DisplaySourceItem[] => {
          const forecastLabel = formatWrfInitTag(forecastTs);
          const primaryLayerId = createCompositeId(layer.id, forecastTs);

          const items: DisplaySourceItem[] = [];

          if (this.isForecastRenderVisible(wrfControls, forecastTs, PRIMARY_RENDER_ID)) {
            items.push({
              layerId: primaryLayerId,
              sourceKind: 'primary',
              layerName: `${baseName} - corrida ${forecastLabel}`,
              forecastTs,
              layer: wrfLayer,
              controls: wrfControls,
            });
          }

          for (const render of wrfLayer.secondaryRenders ?? []) {
            if (!render.pointQuery) {
              continue;
            }

            if (!this.isForecastRenderVisible(wrfControls, forecastTs, render.id)) {
              continue;
            }

            const secondary = render.pointQuery;
            items.push({
              layerId: `${primaryLayerId}#secondary:${secondary.variable}`,
              sourceKind: 'secondary',
              layerName: `${secondary.name} - corrida ${forecastLabel}`,
              forecastTs,
              secondaryRenderId: render.id,
              layer: wrfLayer,
              controls: wrfControls,
              secondary,
            });
          }

          return items;
        });
      });

    return [...satelliteItems, ...radarItems, ...ecmwfItems, ...wrfItems];
  });

  readonly floatingViewerEntries = computed<PointQueryViewerEntry[]>(() => {
    const selectedEntries = this.getSelectedDisplayItems();
    const results = this.resultsBySource();
    const loadingIds = this.loadingLayerIds();

    return selectedEntries.map((entry): PointQueryViewerEntry => {
      const showMovingState = entry.controls.playback.isPlaying;

      return {
        layerId: entry.layerId,
        layerName: entry.layerName,
        data: results.get(entry.layerId) ?? null,
        isLoading: loadingIds.has(entry.layerId) || showMovingState,
      };
    });
  });

  private getSecondaryRender(layer: DisplaySourceItem['layer']) {
    if (layer.type !== LayerType.TILE) return undefined;
    if (layer.category !== LayerCategory.ECMWF_TP) return undefined;
    return (layer as EcmwfTpTileLayer).secondaryRender;
  }

  private isForecastRenderVisible(
    controls: EcmwfTpLayerControls | WrfLayerControls,
    forecastTs: string,
    renderId: string,
  ): boolean {
    return (
      controls.forecast.renderControls[forecastTs]?.selectedRenderIds.includes(renderId) ?? true
    );
  }

  constructor() {
    this.restoredSelectionFromStorage = this.loadStateFromStorage();
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
      const isInitialSync = !this.hasSyncedDisplayItems;
      const shouldAutoSelectNewLayers = !(isInitialSync && this.restoredSelectionFromStorage);

      // Keep manual deselections only for currently available sources.
      const currentManuallyDeselected = this.manuallyDeselectedLayerIds();
      const filteredManuallyDeselected = new Set(
        [...currentManuallyDeselected].filter((layerId) => allLayerIds.has(layerId)),
      );
      if (filteredManuallyDeselected.size !== currentManuallyDeselected.size) {
        this.manuallyDeselectedLayerIds.set(filteredManuallyDeselected);
      }

      const currentSelection = this.selectedLayerIdsOrdered();
      const filteredSelection = currentSelection.filter((layerId) => allLayerIds.has(layerId));
      const newLayerIds = shouldAutoSelectNewLayers
        ? allItems
            .map((item) => item.layerId)
            .filter(
              (layerId) =>
                !currentSelection.includes(layerId) && !filteredManuallyDeselected.has(layerId),
            )
        : [];

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

      if (isInitialSync) {
        this.restoredSelectionFromStorage = false;
        this.hasSyncedDisplayItems = true;
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
            }
            this.loadingLayerIds.set(loadingIds);

            const requests: Array<Observable<SourceQueryResult>> = [];
            for (const entry of selectedEntries) {
              const { layerId, layerName, sourceKind, layer, controls, elevationId, forecastTs } =
                entry;
              const request$ =
                sourceKind === 'secondary'
                  ? this.queryLayerSecondaryPoint(
                      layer,
                      controls,
                      coordinates.lat,
                      coordinates.lon,
                      forecastTs,
                      entry.secondary,
                    )
                  : this.queryLayerPoint(
                      layer,
                      controls,
                      coordinates.lat,
                      coordinates.lon,
                      elevationId,
                      forecastTs,
                    );

              if (!request$) {
                continue;
              }

              requests.push(
                request$.pipe(
                  map(
                    (result): SourceQueryResult => ({
                      layerId,
                      result: { ...result, layerId, layerName },
                    }),
                  ),
                ),
              );
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

    if (!enabled && this.panelMode() === POINT_QUERY_PANEL_MODES.NEAR_MARKER) {
      this.panelMode.set(POINT_QUERY_PANEL_MODES.FIXED);
    }
  }

  setPanelMode(mode: PointQueryPanelMode): void {
    this.panelMode.set(mode);

    // Near-marker mode depends on marker context; keep marker visible.
    if (mode === POINT_QUERY_PANEL_MODES.NEAR_MARKER && !this.showMarker()) {
      this.showMarker.set(true);
    }
  }

  toggleSourceSelection(layerId: string, checked: boolean): void {
    const currentSelection = this.selectedLayerIdsOrdered();

    if (checked) {
      if (currentSelection.includes(layerId)) {
        return;
      }

      this.removeManualDeselection(layerId);

      this.selectedLayerIdsOrdered.set([...currentSelection, layerId]);

      if (!this.enabled()) {
        this.enabled.set(true);
      }

      return;
    }

    this.removeSourceSelection(layerId);
  }

  removeSourceSelection(layerId: string): void {
    this.addManualDeselection(layerId);

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

  private addManualDeselection(layerId: string): void {
    this.manuallyDeselectedLayerIds.update((current) => {
      if (current.has(layerId)) {
        return current;
      }

      const next = new Set(current);
      next.add(layerId);
      return next;
    });
  }

  private removeManualDeselection(layerId: string): void {
    this.manuallyDeselectedLayerIds.update((current) => {
      if (!current.has(layerId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(layerId);
      return next;
    });
  }

  clearSelectedSources(): void {
    this.selectedLayerIdsOrdered.set([]);
    this.resultsBySource.set(new Map());
    this.loadingLayerIds.set(new Set());
  }

  isSourceSelected(layerId: string): boolean {
    return this.selectedLayerIdsOrdered().includes(layerId);
  }

  private queryLayerPoint(
    layer: Layer,
    controls: TileLayerControls,
    lat: number,
    lon: number,
    elevationId?: string,
    forecastTs?: string,
  ): Observable<PointQueryDisplayData> {
    const layerId = layer.id;
    const layerName = layer.name;

    if (layer.type !== LayerType.TILE) {
      return of(this.buildNoData(layerId, layerName, elevationId));
    }

    if (
      (layer.category === LayerCategory.GOES_19 ||
        layer.category === LayerCategory.ECMWF_TP ||
        layer.category === LayerCategory.WRF) &&
      !this.isWithinLayerBounds(layer, lat, lon)
    ) {
      return of(this.buildNoData(layerId, layerName, elevationId));
    }

    if (layer.category === LayerCategory.ECMWF_TP) {
      return this.queryEcmwfTpLayer(layer, controls as EcmwfTpLayerControls, lat, lon, forecastTs);
    }

    if (layer.category === LayerCategory.WRF) {
      return this.queryWrfLayer(layer, controls as WrfLayerControls, lat, lon, forecastTs);
    }

    const tilesetId = this.resolveTilesetId(layer.id, controls.playback.timeIndex);
    if (!tilesetId) {
      return of(this.buildNoData(layerId, layerName, elevationId));
    }

    if (layer.category === LayerCategory.GOES_19) {
      return this.querySatelliteLayer(layer as GoesTileLayer, tilesetId, lat, lon);
    }

    if (layer.category === LayerCategory.RADAR) {
      return this.queryRadarLayer(
        layer as RadarTileLayer,
        controls as RadarLayerControls,
        tilesetId,
        lat,
        lon,
        elevationId,
      );
    }

    return of(this.buildNoData(layerId, layerName, elevationId));
  }

  private queryLayerSecondaryPoint(
    layer: Layer,
    controls: TileLayerControls,
    lat: number,
    lon: number,
    forecastTs?: string,
    wrfSecondary?: WrfSecondaryPointQuery,
  ): Observable<PointQueryDisplayData> | null {
    if (layer.type !== LayerType.TILE) return null;

    if (layer.category === LayerCategory.WRF) {
      return wrfSecondary
        ? this.queryWrfSecondaryPoint(
            layer,
            controls as WrfLayerControls,
            wrfSecondary,
            lat,
            lon,
            forecastTs,
          )
        : null;
    }

    if (layer.category !== LayerCategory.ECMWF_TP) return null;

    const ecmwfLayer = layer as EcmwfTpTileLayer;
    const secondary = ecmwfLayer.secondaryRender;
    if (!secondary?.buildPointQueryUrl) return null;

    if (!this.isWithinLayerBounds(layer, lat, lon)) {
      return of(this.buildNoData(buildSecondaryLayerId(layer.id), 'Presion a nivel del mar'));
    }

    const ecmwfControls = controls as EcmwfTpLayerControls;
    const config = this.layerConfigService.getConfig(layer.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    if (!config || config.availableTilesets.length === 0) {
      return of(this.buildNoData(buildSecondaryLayerId(layer.id), 'Presion a nivel del mar'));
    }

    const isForecast = layer.isForecast;
    const idx = Math.max(
      0,
      Math.min(
        ecmwfControls.playback.timeIndex ??
          getDefaultCursorIndex(config.availableTilesets.length, isForecast),
        config.availableTilesets.length - 1,
      ),
    );
    const timestampTs = config.availableTilesets[idx].id;

    // If the caller pinned a specific forecast (per-run point query), validate
    // it covers this period; otherwise fall back to the first selected
    // forecast that does.
    const forecastsForPeriod = config.forecastsByPeriod[timestampTs];
    const selectedForecasts = ecmwfControls.forecast.selectedForecastTimestamps;
    const resolvedForecastTs = forecastTs
      ? forecastsForPeriod?.includes(forecastTs)
        ? forecastTs
        : undefined
      : selectedForecasts.find((ts) => forecastsForPeriod?.includes(ts));
    if (!resolvedForecastTs) {
      return of(this.buildNoData(buildSecondaryLayerId(layer.id), 'Presion a nivel del mar'));
    }

    const url = secondary.buildPointQueryUrl(resolvedForecastTs, timestampTs, lat, lon);
    const secondaryLayerId = buildSecondaryLayerId(layer.id);
    const secondaryLayerName = 'Presion a nivel del mar';
    const mslpScaleRange: ScaleRangeInfo = { min: 950, max: 1050, totalSteps: 100 };

    return this.http.get<PointQueryValueDto>(url).pipe(
      map(
        (response) =>
          ({
            layerId: secondaryLayerId,
            layerName: secondaryLayerName,
            value: response.value,
            unit: response.unit,
            status: PointQueryStatus.VALUE,
            scaleRange: mslpScaleRange,
          }) as const,
      ),
      catchError((error) =>
        of(this.mapErrorToDisplay(secondaryLayerId, secondaryLayerName, error)),
      ),
    );
  }

  private querySatelliteLayer(
    layer: GoesTileLayer,
    tilesetId: string,
    lat: number,
    lon: number,
  ): Observable<PointQueryDisplayData> {
    const [productId, instrumentId, channelId] = layer.id.split('/');
    const url = buildSatellitePointQueryUrl(
      productId,
      instrumentId,
      channelId,
      tilesetId,
      lat,
      lon,
    );

    const scaleRange = this.extractScaleRange(layer);
    if (!scaleRange) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    return this.http.get<PointQueryValueDto>(url).pipe(
      map(
        (response) =>
          ({
            layerId: layer.id,
            layerName: layer.name,
            value: response.value,
            unit: response.unit,
            status: PointQueryStatus.VALUE,
            scaleRange,
          }) as const,
      ),
      catchError((error) => of(this.mapErrorToDisplay(layer.id, layer.name, error))),
    );
  }

  private queryRadarLayer(
    layer: RadarTileLayer,
    controls: RadarLayerControls,
    tilesetId: string,
    lat: number,
    lon: number,
    elevationId?: string,
  ): Observable<PointQueryDisplayData> {
    const parts = layer.id.split('/');
    const radarId = parts[1];
    const variableId = parts[2];
    const resolvedElevationId = elevationId ?? this.resolveRadarElevation(layer, controls);

    if (!resolvedElevationId) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const url = buildRadarPointQueryUrl(
      radarId,
      variableId,
      resolvedElevationId,
      tilesetId,
      lat,
      lon,
    );

    const scaleRange = this.extractScaleRange(layer);
    if (!scaleRange) {
      return of(this.buildNoData(layer.id, layer.name, resolvedElevationId));
    }

    return this.http.get<PointQueryValueDto>(url).pipe(
      map(
        (response) =>
          ({
            layerId: layer.id,
            layerName: layer.name,
            value: response.value,
            unit: response.unit,
            status: PointQueryStatus.VALUE,
            scaleRange,
            elevationId: resolvedElevationId,
          }) as const,
      ),
      catchError((error) =>
        of(this.mapErrorToDisplay(layer.id, layer.name, error, resolvedElevationId)),
      ),
    );
  }

  private queryEcmwfTpLayer(
    layer: Layer,
    controls: EcmwfTpLayerControls,
    lat: number,
    lon: number,
    forecastTs?: string,
  ): Observable<PointQueryDisplayData> {
    const config = this.layerConfigService.getConfig(layer.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    if (!config || config.availableTilesets.length === 0) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const isForecast = layer.type === LayerType.TILE && layer.isForecast;
    const idx = Math.max(
      0,
      Math.min(
        controls.playback.timeIndex ??
          getDefaultCursorIndex(config.availableTilesets.length, isForecast),
        config.availableTilesets.length - 1,
      ),
    );
    const periodTs = config.availableTilesets[idx].id;

    // If a specific forecast was requested (per-run point query), validate it
    // covers this period; otherwise pick the first selected forecast that does.
    const forecastsForPeriod = config.forecastsByPeriod[periodTs];
    const selectedForecasts = controls.forecast.selectedForecastTimestamps;
    const resolvedForecastTs = forecastTs
      ? forecastsForPeriod?.includes(forecastTs)
        ? forecastTs
        : undefined
      : selectedForecasts.find((ts) => forecastsForPeriod?.includes(ts));
    if (!resolvedForecastTs) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const url = buildEcmwfTpPointQueryUrl(resolvedForecastTs, periodTs, lat, lon);

    const scaleRange = this.extractScaleRange(layer as EcmwfTpTileLayer);
    if (!scaleRange) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    return this.http.get<PointQueryValueDto>(url).pipe(
      map(
        (response) =>
          ({
            layerId: layer.id,
            layerName: layer.name,
            value: response.value,
            unit: response.unit,
            status: PointQueryStatus.VALUE,
            scaleRange,
          }) as const,
      ),
      catchError((error) => of(this.mapErrorToDisplay(layer.id, layer.name, error))),
    );
  }

  private queryWrfLayer(
    layer: Layer,
    controls: WrfLayerControls,
    lat: number,
    lon: number,
    forecastTs?: string,
  ): Observable<PointQueryDisplayData> {
    const config = this.layerConfigService.getConfig(layer.id) as WrfTileLayerConfig | undefined;
    if (!config || config.availableTilesets.length === 0) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const isForecast = layer.type === LayerType.TILE && layer.isForecast;
    const idx = Math.max(
      0,
      Math.min(
        controls.playback.timeIndex ??
          getDefaultCursorIndex(config.availableTilesets.length, isForecast),
        config.availableTilesets.length - 1,
      ),
    );
    // availableTilesets está keyado por instante absoluto (epoch); ese id es la
    // clave de forecastsByPeriod. El fxxx concreto se deriva por corrida.
    const tilesetEntry = config.availableTilesets[idx];
    const tilesetId = tilesetEntry.id;

    // If a specific forecast (init run) was requested, validate it covers this
    // step; otherwise pick the first selected init that does.
    const forecastsForStep = config.forecastsByPeriod[tilesetId];
    const selectedInits = controls.forecast.selectedForecastTimestamps;
    const resolvedInitTag = forecastTs
      ? forecastsForStep?.includes(forecastTs)
        ? forecastTs
        : undefined
      : selectedInits.find((ts) => forecastsForStep?.includes(ts));
    if (!resolvedInitTag) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const fxxx = wrfFxxxForInitAndTime(resolvedInitTag, tilesetEntry.time);
    if (!fxxx) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const wrfLayer = layer as WrfTileLayer;
    const scaleRange = this.extractScaleRange(wrfLayer);
    if (!scaleRange) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const url = buildWrfPointQueryUrl(wrfLayer.productId, resolvedInitTag, fxxx, lat, lon);

    return this.http.get<PointQueryValueDto>(url).pipe(
      map(
        (response) =>
          ({
            layerId: layer.id,
            layerName: layer.name,
            value: response.value,
            unit: response.unit,
            status: PointQueryStatus.VALUE,
            scaleRange,
          }) as const,
      ),
      catchError((error) => of(this.mapErrorToDisplay(layer.id, layer.name, error))),
    );
  }

  private queryWrfSecondaryPoint(
    layer: Layer,
    controls: WrfLayerControls,
    secondary: WrfSecondaryPointQuery,
    lat: number,
    lon: number,
    forecastTs?: string,
  ): Observable<PointQueryDisplayData> {
    // pylint-style: mirrors queryWrfLayer but targets a secondary-variable COG.
    const secondaryLayerId = forecastTs
      ? `${createCompositeId(layer.id, forecastTs)}#secondary:${secondary.variable}`
      : `${layer.id}#secondary:${secondary.variable}`;

    if (!this.isWithinLayerBounds(layer, lat, lon)) {
      return of(this.buildNoData(secondaryLayerId, secondary.name));
    }

    const config = this.layerConfigService.getConfig(layer.id) as WrfTileLayerConfig | undefined;
    if (!config || config.availableTilesets.length === 0) {
      return of(this.buildNoData(secondaryLayerId, secondary.name));
    }

    const isForecast = layer.type === LayerType.TILE && layer.isForecast;
    const idx = Math.max(
      0,
      Math.min(
        controls.playback.timeIndex ??
          getDefaultCursorIndex(config.availableTilesets.length, isForecast),
        config.availableTilesets.length - 1,
      ),
    );
    const tilesetEntry = config.availableTilesets[idx];

    const forecastsForStep = config.forecastsByPeriod[tilesetEntry.id];
    const selectedInits = controls.forecast.selectedForecastTimestamps;
    const resolvedInitTag = forecastTs
      ? forecastsForStep?.includes(forecastTs)
        ? forecastTs
        : undefined
      : selectedInits.find((ts) => forecastsForStep?.includes(ts));
    if (!resolvedInitTag) {
      return of(this.buildNoData(secondaryLayerId, secondary.name));
    }

    const fxxx = wrfFxxxForInitAndTime(resolvedInitTag, tilesetEntry.time);
    if (!fxxx) {
      return of(this.buildNoData(secondaryLayerId, secondary.name));
    }

    const wrfLayer = layer as WrfTileLayer;
    const url = buildWrfSecondaryPointQueryUrl(
      wrfLayer.productId,
      resolvedInitTag,
      fxxx,
      secondary.variable,
      lat,
      lon,
    );

    return this.http.get<PointQueryValueDto>(url).pipe(
      map(
        (response) =>
          ({
            layerId: secondaryLayerId,
            layerName: secondary.name,
            value: response.value,
            unit: response.unit,
            status: PointQueryStatus.VALUE,
            scaleRange: secondary.scaleRange,
          }) as const,
      ),
      catchError((error) => of(this.mapErrorToDisplay(secondaryLayerId, secondary.name, error))),
    );
  }

  private resolveTilesetId(layerId: string, timeIndex?: number): string | null {
    const config = this.layerConfigService.getConfig(layerId);
    if (!config || config.type !== LayerType.TILE || config.availableTilesets.length === 0) {
      return null;
    }

    const layer = this.layersService.getLayerById(layerId);
    const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
    const fallbackIndex = getDefaultCursorIndex(config.availableTilesets.length, isForecast);
    const resolvedIndex = timeIndex ?? fallbackIndex;
    const clampedIndex = Math.max(0, Math.min(resolvedIndex, config.availableTilesets.length - 1));

    return config.availableTilesets[clampedIndex]?.id ?? null;
  }

  private resolveRadarElevation(
    layer: RadarTileLayer,
    controls: RadarLayerControls,
  ): string | null {
    if (controls.elevation.selectedElevationIds.length > 0) {
      return controls.elevation.selectedElevationIds[0];
    }

    return layer.availableElevations[0]?.id ?? null;
  }

  private isWithinLayerBounds(layer: Layer, lat: number, lon: number): boolean {
    if (!layer.boundingBox) {
      return true;
    }

    const [[south, west], [north, east]] = layer.boundingBox;
    const m = POINT_QUERY_BOUNDS_MARGIN_DEG;
    return lat >= south - m && lat <= north + m && lon >= west - m && lon <= east + m;
  }

  private mapErrorToDisplay(
    layerId: string,
    layerName: string,
    error: unknown,
    elevationId?: string,
  ): PointQueryDisplayData {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return this.buildNoData(layerId, layerName, elevationId);
    }

    return {
      layerId,
      layerName,
      status: PointQueryStatus.ERROR,
      ...(elevationId && { elevationId }),
    } as const;
  }

  private buildNoData(
    layerId: string,
    layerName: string,
    elevationId?: string,
  ): PointQueryDisplayData {
    return {
      layerId,
      layerName,
      status: PointQueryStatus.NO_DATA,
      ...(elevationId && { elevationId }),
    } as const;
  }

  private extractScaleRange(
    layer: GoesTileLayer | RadarTileLayer | EcmwfTpTileLayer | WrfTileLayer,
  ): ScaleRangeInfo | undefined {
    if (!layer.scale) {
      return undefined;
    }

    const scale = layer.scale;

    try {
      switch (scale.type) {
        case ScaleType.CONTINUOUS:
        case ScaleType.DISCRETE: {
          const typedScale = scale as LayerScale;
          if (typedScale.entries.length < 1) return undefined;

          const clipRange = typedScale.clipRange;
          const [min, max] = clipRange
            ? clipRange[0] <= clipRange[1]
              ? [clipRange[0], clipRange[1]]
              : [clipRange[1], clipRange[0]]
            : [
                typedScale.entries[0].value,
                typedScale.entries[typedScale.entries.length - 1].value,
              ];

          return {
            min,
            max,
            totalSteps: typedScale.entries.length,
          };
        }

        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
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

  private loadStateFromStorage(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.POINT_QUERY_VIEWER);
      if (!raw) {
        return false;
      }

      const parsed = JSON.parse(raw) as PersistedPointQueryViewerState;

      const showMarker = parsed.showMarker ?? false;
      const panelMode = parsed.panelMode ?? POINT_QUERY_PANEL_MODES.FIXED;

      this.enabled.set(parsed.enabled ?? false);
      this.selectedLayerIdsOrdered.set(parsed.selectedLayerIdsOrdered ?? []);
      this.manuallyDeselectedLayerIds.set(new Set(parsed.manuallyDeselectedLayerIds ?? []));
      this.showMarker.set(showMarker);
      this.panelMode.set(showMarker ? panelMode : POINT_QUERY_PANEL_MODES.FIXED);
      return true;
    } catch (error) {
      console.warn('Failed to load point query viewer state from localStorage:', error);
      return false;
    }
  }

  private saveStateToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload: PersistedPointQueryViewerState = {
      enabled: this.enabled(),
      selectedLayerIdsOrdered: this.selectedLayerIdsOrdered(),
      manuallyDeselectedLayerIds: [...this.manuallyDeselectedLayerIds()],
      showMarker: this.showMarker(),
      panelMode: this.panelMode(),
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
