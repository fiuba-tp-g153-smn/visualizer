import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { buildIntersectCountryUrl, buildIntersectDepartmentsUrl } from '../../config';
import { DepartmentsResponse } from '../../models/geo';
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
            .map((dept) => ({
              name: (dept.properties && dept.properties['nam']) || 'Desconocido',
              geometry: dept.geometry,
              intersection: dept.intersection,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        })),
      );
  }
}
