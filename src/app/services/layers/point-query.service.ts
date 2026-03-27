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
  PointQueryDisplayData,
  PointQueryStatus,
  PointQueryValueDto,
} from '../../models';
import { LayerConfigService } from './layer-config.service';
import { buildRadarPointQueryUrl, buildSatellitePointQueryUrl } from '../../config';

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
    elevationId?: string,
  ): Observable<PointQueryDisplayData> {
    const layerId = layer.id;
    const layerName = layer.name;

    if (layer.type !== LayerType.TILE) {
      return of(this.buildNoData(layerId, layerName, elevationId));
    }

    if (layer.category === LayerCategory.GOES_19 && !this.isWithinLayerBounds(layer, lat, lon)) {
      // Optimization: no backend request if satellite cursor is outside configured bounds.
      return of(this.buildNoData(layerId, layerName, elevationId));
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

    return this.http.get<PointQueryValueDto>(url).pipe(
      map((response) => ({
        layerId: layer.id,
        layerName: layer.name,
        value: response.value,
        unit: response.unit,
        status: PointQueryStatus.VALUE,
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
    elevationId?: string,
  ): Observable<PointQueryDisplayData> {
    const parts = layer.id.split('/');
    const radarId = parts[1];
    const variableId = parts[2];
    const resolvedElevationId = elevationId ?? this.resolveRadarElevation(layer, controls);

    if (!resolvedElevationId) {
      return of(this.buildNoData(layer.id, layer.name, elevationId));
    }

    const url = buildRadarPointQueryUrl(
      radarId,
      variableId,
      resolvedElevationId,
      tilesetId,
      lat,
      lon,
    );

    return this.http.get<PointQueryValueDto>(url).pipe(
      map((response) => ({
        layerId: layer.id,
        elevationId: resolvedElevationId,
        layerName: layer.name,
        value: response.value,
        unit: response.unit,
        status: PointQueryStatus.VALUE,
      })),
      catchError((error) =>
        of(this.mapErrorToDisplay(layer.id, layer.name, error, resolvedElevationId)),
      ),
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
      elevationId,
      layerName,
      value: null,
      unit: null,
      status: PointQueryStatus.ERROR,
    };
  }

  private buildNoData(
    layerId: string,
    layerName: string,
    elevationId?: string,
  ): PointQueryDisplayData {
    return {
      layerId,
      elevationId,
      layerName,
      value: null,
      unit: null,
      status: PointQueryStatus.NO_DATA,
    };
  }
}
