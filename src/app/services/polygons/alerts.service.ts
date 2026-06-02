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

/**
 * Constantes para parámetros HTTP
 */
const HTTP_PARAMS = {
  SIMPLIFICATION_LEVEL: 'simplification_level',
} as const;

/**
 * Departamento tal como viene del backend (con properties)
 */
interface DepartmentBackendResponse {
  properties: Record<string, any>;
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

/**
 * Respuesta del endpoint de generación de alertas
 */
export interface GenerateAlertsResponse {
  alert_id: number;
  timestamp: string;
  phenomenon_code: number;
  phenomenon: string;
  gif_area_url: string;
  gif_gral_url: string;
  affected_departments_count: number;
}

/**
 * Servicio para interactuar con el backend de alertas (alert-service)
 * Proporciona funcionalidades de recorte de polígonos y consulta de departamentos
 */
@Injectable({
  providedIn: 'root',
})
export class AlertsService {
  private readonly http = inject(HttpClient);

  /**
   * Crea los parámetros HTTP comunes para las requests
   */
  private buildParams(simplificationLevel: number): HttpParams {
    return new HttpParams().set(HTTP_PARAMS.SIMPLIFICATION_LEVEL, simplificationLevel.toString());
  }

  /**
   * Recorta un polígono con los límites de Argentina
   * @param coordinates - Coordenadas del polígono [lat, lng][]
   * @param simplificationLevel - Nivel de simplificación geométrica (0-10, 0 = sin simplificación, 10 = máxima simplificación)
   * @returns Observable con las coordenadas del polígono recortado
   */
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

  /**
   * Obtiene los departamentos que intersectan con un polígono
   * @param coordinates - Coordenadas del polígono [lat, lng][]
   * @param simplificationLevel - Nivel de simplificación geométrica (0-10, 0 = sin simplificación, 10 = máxima simplificación)
   * @returns Observable con la lista de departamentos
   */
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

  /**
   * Genera alertas meteorológicas para un polígono
   * @param coordinates - Coordenadas del polígono [lat, lng][]
   * @param phenomenonCode - Código del fenómeno meteorológico
   * @returns Observable con las URLs de las alertas generadas
   */
  generateAlerts(
    coordinates: Array<[number, number]>,
    phenomenonCode: number,
  ): Observable<GenerateAlertsResponse> {
    const url = buildGenerateAlertsUrl(phenomenonCode);
    const geoJson = coordinatesToGeoJSON(coordinates);

    return this.http.post<GenerateAlertsResponse>(url, geoJson);
  }

  /**
   * Obtiene todos los fenómenos meteorológicos disponibles
   * @returns Observable con la lista de fenómenos
   */
  getPhenomena(): Observable<Phenomenon[]> {
    const url = buildPhenomenaUrl();
    return this.http.get<Phenomenon[]>(url);
  }

  /**
   * Obtiene los avisos activos. Con `sinceId` solo devuelve los de id mayor.
   * @param sinceId - Devuelve solo avisos con alert_id mayor a este valor
   * @returns Observable con la lista de avisos activos
   */
  getAlerts(sinceId?: number): Observable<ActiveAlertResponse[]> {
    const url = buildAlertsUrl();
    let params = new HttpParams();
    if (sinceId !== undefined) {
      params = params.set('since_id', sinceId.toString());
    }

    return this.http.get<ActiveAlertResponse[]>(url, { params });
  }
}
