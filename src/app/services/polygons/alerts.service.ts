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
  USE_SIMPLIFIED: 'use_simplified',
} as const;

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
  private buildParams(useSimplified: boolean): HttpParams {
    return new HttpParams().set(HTTP_PARAMS.USE_SIMPLIFIED, useSimplified.toString());
  }

  /**
   * Recorta un polígono con los límites de Argentina
   * @param coordinates - Coordenadas del polígono [lat, lng][]
   * @param useSimplified - Usar geometrías simplificadas (más rápido, menor detalle)
   * @returns Observable con las coordenadas del polígono recortado
   */
  intersectCountry(
    coordinates: Array<[number, number]>,
    useSimplified: boolean = true,
  ): Observable<Array<[number, number]>> {
    const url = buildIntersectCountryUrl();
    const geoJson = coordinatesToGeoJSON(coordinates);
    const params = this.buildParams(useSimplified);

    return this.http
      .post<GeoJSON.FeatureCollection>(url, geoJson, { params })
      .pipe(map((response) => geoJSONToCoordinates(response)));
  }

  /**
   * Obtiene los departamentos que intersectan con un polígono
   * @param coordinates - Coordenadas del polígono [lat, lng][]
   * @param useSimplified - Usar geometrías simplificadas
   * @returns Observable con la lista de departamentos
   */
  intersectDepartments(
    coordinates: Array<[number, number]>,
    useSimplified: boolean = true,
  ): Observable<DepartmentsResponse> {
    const url = buildIntersectDepartmentsUrl();
    const geoJson = coordinatesToGeoJSON(coordinates);
    const params = this.buildParams(useSimplified);

    return this.http.post<DepartmentsResponse>(url, geoJson, { params });
  }
}
