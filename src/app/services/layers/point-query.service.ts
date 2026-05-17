import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';

import {
  Layer,
  LayerCategory,
  LayerType,
  TileLayerControls,
  RadarLayerControls,
  RadarTileLayer,
  GoesTileLayer,
  EcmwfTpLayerControls,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
  PointQueryDisplayData,
  PointQueryStatus,
  PointQueryValueDto,
  ScaleRangeInfo,
  ScaleType,
  PaletteConfigScale,
  ContinuousScale,
  DiscreteScale,
} from '../../models';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { getDefaultCursorIndex } from '../../utils/playback-window';
import {
  buildRadarPointQueryUrl,
  buildSatellitePointQueryUrl,
  buildEcmwfTpPointQueryUrl,
} from '../../config';

/**
 * Suffix appended to a layer's id when reporting results from its secondary
 * vector overlay (e.g. ECMWF TP raster + MSLP isobars). Used as a synthetic
 * key on the results map and on the displayed card.
 */
export const SECONDARY_LAYER_ID_SUFFIX = '#secondary';

export function buildSecondaryLayerId(layerId: string): string {
  return `${layerId}${SECONDARY_LAYER_ID_SUFFIX}`;
}

@Injectable({
  providedIn: 'root',
})
export class PointQueryService {
  private readonly http = inject(HttpClient);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly layersService = inject(LayersService);

  queryLayerPoint(
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
      (layer.category === LayerCategory.GOES_19 || layer.category === LayerCategory.ECMWF_TP) &&
      !this.isWithinLayerBounds(layer, lat, lon)
    ) {
      // Optimization: no backend request if cursor is outside configured bounds.
      return of(this.buildNoData(layerId, layerName, elevationId));
    }

    if (layer.category === LayerCategory.ECMWF_TP) {
      return this.queryEcmwfTpLayer(layer, controls as EcmwfTpLayerControls, lat, lon, forecastTs);
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

  /**
   * Issues the point query for the secondary overlay attached to a primary
   * layer (e.g. MSLP isobars on top of ECMWF TP). Returns null when the layer
   * has no secondary point endpoint configured.
   *
   * The result is reported under a synthetic layer id (`${layerId}#secondary`)
   * so the UI can render it as a paired card alongside the primary value.
   */
  queryLayerSecondaryPoint(
    layer: Layer,
    controls: TileLayerControls,
    lat: number,
    lon: number,
    forecastTs?: string,
  ): Observable<PointQueryDisplayData> | null {
    if (layer.type !== LayerType.TILE) return null;
    if (layer.category !== LayerCategory.ECMWF_TP) return null;

    const ecmwfLayer = layer as EcmwfTpTileLayer;
    const secondary = ecmwfLayer.secondaryRender;
    if (!secondary?.buildPointQueryUrl) return null;

    if (!this.isWithinLayerBounds(layer, lat, lon)) {
      return of(this.buildNoData(buildSecondaryLayerId(layer.id), 'Presión a nivel del mar'));
    }

    const ecmwfControls = controls as EcmwfTpLayerControls;
    const config = this.layerConfigService.getConfig(layer.id) as
      | EcmwfTpTileLayerConfig
      | undefined;
    if (!config || config.availableTilesets.length === 0) {
      return of(this.buildNoData(buildSecondaryLayerId(layer.id), 'Presión a nivel del mar'));
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

    const forecastsForPeriod = config.forecastsByPeriod[timestampTs];
    const resolvedForecastTs = forecastTs
      ? forecastsForPeriod?.includes(forecastTs)
        ? forecastTs
        : undefined
      : ecmwfControls.forecast.selectedForecastTimestamps.find((ts) =>
          forecastsForPeriod?.includes(ts),
        );
    if (!resolvedForecastTs) {
      return of(this.buildNoData(buildSecondaryLayerId(layer.id), 'Presión a nivel del mar'));
    }

    const url = secondary.buildPointQueryUrl(resolvedForecastTs, timestampTs, lat, lon);
    const secondaryLayerId = buildSecondaryLayerId(layer.id);
    const secondaryLayerName = 'Presión a nivel del mar';
    // MSLP no tiene un LayerScale configurado en el visualizator; el gauge usa
    // un rango sinóptico estándar (950-1050 hPa).
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

    // Resolve the period from the union-based availableTilesets
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

    // If a specific forecast was requested, validate it covers the current period;
    // otherwise pick the first selected forecast that has this period.
    const forecastsForPeriod = config.forecastsByPeriod[periodTs];
    const resolvedForecastTs = forecastTs
      ? forecastsForPeriod?.includes(forecastTs)
        ? forecastTs
        : undefined
      : controls.forecast.selectedForecastTimestamps.find((ts) => forecastsForPeriod?.includes(ts));
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

  private resolveTilesetId(layerId: string, timeIndex?: number): string | null {
    const config = this.layerConfigService.getConfig(layerId);
    if (!config || config.type !== LayerType.TILE || config.availableTilesets.length === 0) {
      return null;
    }

    // Use the timeIndex from controls (synced by LayerControlService with latest config).
    // Fallback to the layer's default cursor: first frame for forecasts, last otherwise.
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
    return lat >= south && lat <= north && lon >= west && lon <= east;
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

  /**
   * Extracts scale range information from a layer's scale definition.
   * Returns min, max, and total steps for visualization purposes.
   */
  private extractScaleRange(
    layer: GoesTileLayer | RadarTileLayer | EcmwfTpTileLayer,
  ): ScaleRangeInfo | undefined {
    if (!layer.scale) {
      return undefined;
    }

    const scale = layer.scale;

    try {
      switch (scale.type) {
        case ScaleType.CONTINUOUS:
          const continuousScale = scale as ContinuousScale;
          if (continuousScale.stops.length < 2) return undefined;
          return {
            min: continuousScale.stops[0].value,
            max: continuousScale.stops[continuousScale.stops.length - 1].value,
            totalSteps: continuousScale.stops.length,
          };

        case ScaleType.DISCRETE:
          const discreteScale = scale as DiscreteScale;
          if (discreteScale.steps.length < 1) return undefined;
          return {
            min: discreteScale.steps[0].value,
            max: discreteScale.steps[discreteScale.steps.length - 1].value,
            totalSteps: discreteScale.steps.length,
          };

        case ScaleType.PALETTE_CONFIG:
          const paletteScale = scale as PaletteConfigScale;
          if (!paletteScale.bounds || paletteScale.bounds.length < 2) return undefined;
          const bounds = [...paletteScale.bounds].sort((a, b) => a - b);
          return {
            min: bounds[0],
            max: bounds[bounds.length - 1],
            totalSteps: paletteScale.hexColors.length,
          };

        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
  }
}
