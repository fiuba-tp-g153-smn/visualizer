import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  buildIntersectCountryUrl,
  buildIntersectDepartmentsUrl,
  buildGenerateAlertsUrl,
  buildPhenomenaUrl,
  buildAlertsUrl,
  getProvinceNameFromDepartmentCode,
} from '../../config';
import { ActiveAlertResponse, DepartmentsResponse } from '../../models/geo';
import { Phenomenon } from '../../models/phenomenon.model';
import { coordinatesToGeoJSON, geoJSONToCoordinates } from '../../utils/geojson.utils';

const HTTP_PARAMS = {
  SIMPLIFICATION_LEVEL: 'simplification_level',
} as const;

interface DepartmentBackendResponse {
  properties: Record<string, any>;
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

export interface GenerateAlertsResponse {
  alert_id: number;
  timestamp: string;
  phenomenon_code: number;
  phenomenon: string;
  gif_area_url: string;
  gif_gral_url: string;
  affected_departments_count: number;
}

@Injectable({
  providedIn: 'root',
})
export class AlertsService {
  private readonly http = inject(HttpClient);

  private buildParams(simplificationLevel: number): HttpParams {
    return new HttpParams().set(HTTP_PARAMS.SIMPLIFICATION_LEVEL, simplificationLevel.toString());
  }

  intersectCountry(
    coordinates: Array<[number, number]>,
    simplificationLevel: number = 0,
  ): Observable<Array<[number, number]>> {
    const url = buildIntersectCountryUrl();
    const geoJson = coordinatesToGeoJSON(coordinates);
    const params = this.buildParams(simplificationLevel);

    return this.http
      .post<GeoJSON.FeatureCollection>(url, geoJson, { params })
      .pipe(map((response) => geoJSONToCoordinates(response)));
  }

  intersectDepartments(
    coordinates: Array<[number, number]>,
    simplificationLevel: number = 0,
  ): Observable<DepartmentsResponse> {
    const url = buildIntersectDepartmentsUrl();
    const geoJson = coordinatesToGeoJSON(coordinates);
    const params = this.buildParams(simplificationLevel);

    return this.http
      .post<{ departments: DepartmentBackendResponse[] }>(url, geoJson, { params })
      .pipe(
        map((response) => ({
          departments: response.departments
            .map((dept) => {
              const departmentCode = dept.properties?.['in1'];
              return {
                name: (dept.properties && dept.properties['nam']) || 'Desconocido',
                province: getProvinceNameFromDepartmentCode(departmentCode),
                geometry: dept.geometry,
                intersection: dept.intersection,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name)),
        })),
      );
  }

  generateAlerts(
    coordinates: Array<[number, number]>,
    phenomenonCode: number,
  ): Observable<GenerateAlertsResponse> {
    const url = buildGenerateAlertsUrl(phenomenonCode);
    const geoJson = coordinatesToGeoJSON(coordinates);

    return this.http.post<GenerateAlertsResponse>(url, geoJson);
  }

  getPhenomena(): Observable<Phenomenon[]> {
    const url = buildPhenomenaUrl();
    return this.http.get<Phenomenon[]>(url);
  }

  getAlerts(sinceId?: number): Observable<ActiveAlertResponse[]> {
    const url = buildAlertsUrl();
    let params = new HttpParams();
    if (sinceId !== undefined) {
      params = params.set('since_id', sinceId.toString());
    }

    return this.http.get<ActiveAlertResponse[]>(url, { params });
  }
}
