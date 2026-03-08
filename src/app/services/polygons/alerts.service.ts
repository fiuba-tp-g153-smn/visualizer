import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildIntersectCountryUrl, buildIntersectDepartmentsUrl } from '../../config';

/**
 * Representa un departamento con sus geometrías
 */
export interface Department {
  properties: {
    [key: string]: any;
  };
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

/**
 * Respuesta del endpoint de departamentos
 */
export interface DepartmentsResponse {
  departments: Department[];
}

/**
 * Convierte coordenadas de polígono a formato GeoJSON
 */
function coordinatesToGeoJSON(coordinates: Array<[number, number]>): GeoJSON.Polygon {
  // Las coordenadas de Leaflet vienen como [lat, lng], pero GeoJSON usa [lng, lat]
  const geoJsonCoords = coordinates.map(([lat, lng]) => [lng, lat]);

  // Cerrar el anillo si no está cerrado
  if (
    geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
    geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1]
  ) {
    geoJsonCoords.push(geoJsonCoords[0]);
  }

  const geoJson: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [geoJsonCoords],
  };

  return geoJson;
}

/**
 * Convierte GeoJSON a coordenadas de Leaflet
 */
function geoJSONToCoordinates(
  geoJson: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry,
): Array<[number, number]> {
  let geometry: GeoJSON.Geometry;

  if (geoJson.type === 'FeatureCollection') {
    if ((geoJson as GeoJSON.FeatureCollection).features.length === 0) {
      return [];
    }
    geometry = ((geoJson as GeoJSON.FeatureCollection).features[0] as GeoJSON.Feature).geometry;
  } else if (geoJson.type === 'Feature') {
    geometry = (geoJson as GeoJSON.Feature).geometry;
  } else {
    geometry = geoJson as GeoJSON.Geometry;
  }

  let coords: GeoJSON.Position[];

  if (geometry.type === 'Polygon') {
    coords = (geometry as GeoJSON.Polygon).coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    const multiPolygon = geometry as GeoJSON.MultiPolygon;

    // Find the largest polygon by number of coordinates
    let largestPolygon = multiPolygon.coordinates[0][0];
    let maxSize = largestPolygon.length;

    for (const polygon of multiPolygon.coordinates) {
      const size = polygon[0].length;
      if (size > maxSize) {
        maxSize = size;
        largestPolygon = polygon[0];
      }
    }

    coords = largestPolygon;
  } else {
    console.warn('[AlertsService] Unsupported geometry type:', geometry.type);
    return [];
  }

  // Convertir de [lng, lat] a [lat, lng]
  const leafletCoords = coords.map(([lng, lat]) => [lat, lng] as [number, number]);

  return leafletCoords;
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
    console.log('[AlertsService] intersectCountry called');
    console.log('[AlertsService] URL:', url);
    console.log('[AlertsService] useSimplified:', useSimplified);

    const geoJson = coordinatesToGeoJSON(coordinates);

    const params = new HttpParams().set('use_simplified', useSimplified.toString());

    return new Observable((observer) => {
      console.log('[AlertsService] Making POST request...');
      this.http.post<GeoJSON.FeatureCollection>(url, geoJson, { params }).subscribe({
        next: (response) => {
          console.log('[AlertsService] Received response from backend');
          const coords = geoJSONToCoordinates(response);
          console.log('[AlertsService] Final result coordinates count:', coords.length);
          observer.next(coords);
          observer.complete();
        },
        error: (error) => {
          console.error('[AlertsService] HTTP request failed:', error);
          observer.error(error);
        },
      });
    });
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

    const params = new HttpParams().set('use_simplified', useSimplified.toString());

    return this.http.post<DepartmentsResponse>(url, geoJson, { params });
  }
}
