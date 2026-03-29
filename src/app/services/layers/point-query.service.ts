import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';

import {
  Layer,
  LayerCategory,
  LayerType,
  TileLayerControls,
  GoesLayerControls,
  RadarLayerControls,
  RadarTileLayer,
  GoesTileLayer,
  EcmwfLayerControls,
  EcmwfTileLayerConfig,
  PointQueryDisplayData,
  RadarPointQueryResponse,
  SatellitePointQueryResponse,
  EcmwfPointQueryResponse,
} from '../../models';
import { LayerConfigService } from './layer-config.service';
import {
  buildRadarPointQueryUrl,
  buildSatellitePointQueryUrl,
  buildEcmwfPointQueryUrl,
} from '../../config';

@Injectable({
  providedIn: 'root',
})
export class PointQueryService {
  private readonly http = inject(HttpClient);
  private readonly layerConfigService = inject(LayerConfigService);

  queryLayerPoint(
    layer: Layer,
    controls: TileLayerControls,
    lat: number,
    lon: number,
  ): Observable<PointQueryDisplayData> {
    const layerId = layer.id;
    const layerName = layer.name;

    if (layer.type !== LayerType.TILE) {
      return of(this.buildNoData(layerId, layerName));
    }

    if (
      (layer.category === LayerCategory.GOES_19 || layer.category === LayerCategory.ECMWF) &&
      !this.isWithinLayerBounds(layer, lat, lon)
    ) {
      return of(this.buildNoData(layerId, layerName));
    }

    if (layer.category === LayerCategory.ECMWF) {
      return this.queryEcmwfLayer(layer, controls as EcmwfLayerControls, lat, lon);
    }

    const tilesetId = this.resolveTilesetId(layer.id, controls.playback.timeIndex);
    if (!tilesetId) {
      return of(this.buildNoData(layerId, layerName));
    }

    if (layer.category === LayerCategory.GOES_19) {
      return this.querySatelliteLayer(layer as GoesTileLayer, tilesetId, lat, lon);
    }

    if (layer.category === LayerCategory.RADAR) {
      return this.queryRadarLayer(layer as RadarTileLayer, controls as RadarLayerControls, tilesetId, lat, lon);
    }

    return of(this.buildNoData(layerId, layerName));
  }

  private querySatelliteLayer(
    layer: GoesTileLayer,
    tilesetId: string,
    lat: number,
    lon: number,
  ): Observable<PointQueryDisplayData> {
    const [productId, instrumentId, channelId] = layer.id.split('/');
    const url = buildSatellitePointQueryUrl(productId, instrumentId, channelId, tilesetId, lat, lon);

    return this.http.get<SatellitePointQueryResponse>(url).pipe(
      map((response) => ({
        layerId: layer.id,
        layerName: layer.name,
        value: response.value,
        unit: response.unit,
        status: 'value' as const,
      })),
      catchError((error) => of(this.mapErrorToDisplay(layer.id, layer.name, error))),
    );
  }

  private queryRadarLayer(
    layer: RadarTileLayer,
    controls: RadarLayerControls,
    tilesetId: string,
    lat: number,
    lon: number,
  ): Observable<PointQueryDisplayData> {
    const parts = layer.id.split('/');
    const radarId = parts[1];
    const variableId = parts[2];
    const elevationId = this.resolveRadarElevation(layer, controls);

    if (!elevationId) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const url = buildRadarPointQueryUrl(radarId, variableId, elevationId, tilesetId, lat, lon);

    return this.http.get<RadarPointQueryResponse>(url).pipe(
      map((response) => ({
        layerId: layer.id,
        layerName: layer.name,
        value: response.value,
        unit: response.unit,
        status: 'value' as const,
      })),
      catchError((error) => of(this.mapErrorToDisplay(layer.id, layer.name, error))),
    );
  }

  private queryEcmwfLayer(
    layer: Layer,
    controls: EcmwfLayerControls,
    lat: number,
    lon: number,
  ): Observable<PointQueryDisplayData> {
    const config = this.layerConfigService.getConfig(layer.id) as EcmwfTileLayerConfig | undefined;
    if (!config || config.availableTilesets.length === 0) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    // Resolve the period from the union-based availableTilesets
    const idx = Math.max(
      0,
      Math.min(
        controls.playback.timeIndex ?? config.availableTilesets.length - 1,
        config.availableTilesets.length - 1,
      ),
    );
    const periodTs = config.availableTilesets[idx];

    // Pick the first selected forecast that has this period
    const forecastsForPeriod = config.forecastsByPeriod[periodTs];
    const selectedForecasts = controls.forecast.selectedForecastTimestamps;
    const forecastTs = selectedForecasts.find((ts) => forecastsForPeriod?.includes(ts));
    if (!forecastTs) {
      return of(this.buildNoData(layer.id, layer.name));
    }

    const url = buildEcmwfPointQueryUrl(forecastTs, periodTs, lat, lon);

    return this.http.get<EcmwfPointQueryResponse>(url).pipe(
      map((response) => ({
        layerId: layer.id,
        layerName: layer.name,
        value: response.value,
        unit: response.unit,
        status: 'value' as const,
      })),
      catchError((error) => of(this.mapErrorToDisplay(layer.id, layer.name, error))),
    );
  }

  private resolveTilesetId(layerId: string, timeIndex?: number): string | null {
    const config = this.layerConfigService.getConfig(layerId);
    if (!config || config.type !== LayerType.TILE || config.availableTilesets.length === 0) {
      return null;
    }

    const fallbackIndex = config.availableTilesets.length - 1;
    const resolvedIndex = timeIndex ?? fallbackIndex;
    const clampedIndex = Math.max(0, Math.min(resolvedIndex, config.availableTilesets.length - 1));

    return config.availableTilesets[clampedIndex] ?? null;
  }

  private resolveRadarElevation(layer: RadarTileLayer, controls: RadarLayerControls): string | null {
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

  private mapErrorToDisplay(layerId: string, layerName: string, error: unknown): PointQueryDisplayData {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return this.buildNoData(layerId, layerName);
    }

    return {
      layerId,
      layerName,
      value: null,
      unit: null,
      status: 'error',
    };
  }

  private buildNoData(layerId: string, layerName: string): PointQueryDisplayData {
    return {
      layerId,
      layerName,
      value: null,
      unit: null,
      status: 'no-data',
    };
  }
}
