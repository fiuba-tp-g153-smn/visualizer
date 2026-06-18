import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  buildIntersectCountryUrl,
  buildIntersectDepartmentsUrl,
  buildGenerateAlertsUrl,
  buildAlertJobUrl,
  buildPhenomenaUrl,
  buildAlertsUrl,
  buildPendingAlertsUrl,
  buildAlertsLimitsUrl,
  getProvinceNameFromDepartmentCode,
} from '../../config';
import {
  ActiveAlertResponse,
  DepartmentsResponse,
  LatLng,
  PendingAlertResponse,
} from '../../models/geo';
import { Phenomenon } from '../../models/phenomenon.model';
import { coordinatesToGeoJSON, geoJSONToCoordinates } from '../../utils/geojson.utils';

const HTTP_PARAMS = {
  DETAIL_LEVEL: 'detail_level',
} as const;

interface DepartmentBackendResponse {
  properties: Record<string, any>;
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

/** Body returned by `GET /alerts/limits` and by `POST /alerts` on 413. */
export interface AlertsLimitsResponse {
  max_vertex_count: number;
}

/** Body returned by `POST /alerts` (202): the alert is generated in background. */
export interface AlertJobAccepted {
  job_id: string;
  phenomenon_code: number;
  phenomenon: string;
  /** Polygon vertices serialized as "[lat,lon],[lat,lon],..." */
  polygon: string;
}

/** Status of a background alert generation job (`GET /alerts/jobs/{id}`). */
export interface AlertJobStatus {
  job_id: string;
  /** queued | processing | done | failed (plus client-only "timeout"). */
  status: string;
  /** Present on `done`: the generated alert id (IdAviso_temporal). */
  alert_id: number | null;
  /** Present on `failed`: stable reason code, e.g. "area_too_large". */
  error_code: string | null;
  /** Present on `failed`: human-readable message. */
  error: string | null;
}

/**
 * Result of an ETag-conditional fetch of pending alerts: either a fresh list
 * with its ETag, or confirmation that the cached list is still valid.
 */
export type PendingAlertsResult =
  | { kind: 'updated'; alerts: PendingAlertResponse[]; etag: string }
  | { kind: 'not-modified' };

@Injectable({
  providedIn: 'root',
})
export class DepartmentIntersectionService {
  private readonly http = inject(HttpClient);

  private buildParams(detailLevel: number): HttpParams {
    return new HttpParams().set(HTTP_PARAMS.DETAIL_LEVEL, detailLevel.toString());
  }

  intersectCountry(coordinates: Array<LatLng>, detailLevel: number = 5): Observable<Array<LatLng>> {
    const url = buildIntersectCountryUrl();
    const geoJson = coordinatesToGeoJSON(coordinates);
    const params = this.buildParams(detailLevel);

    return this.http
      .post<GeoJSON.FeatureCollection>(url, geoJson, { params })
      .pipe(map((response) => geoJSONToCoordinates(response)));
  }

  intersectDepartments(coordinates: Array<LatLng>): Observable<DepartmentsResponse> {
    const url = buildIntersectDepartmentsUrl();
    const geoJson = coordinatesToGeoJSON(coordinates);

    return this.http.post<{ departments: DepartmentBackendResponse[] }>(url, geoJson).pipe(
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
    coordinates: Array<LatLng>,
    phenomenonCode: number,
  ): Observable<AlertJobAccepted> {
    const url = buildGenerateAlertsUrl();
    const geojson = coordinatesToGeoJSON(coordinates);

    return this.http.post<AlertJobAccepted>(url, {
      phenomenon_code: phenomenonCode,
      geojson,
    });
  }

  /** Fetches the status of a background alert generation job. */
  getAlertJob(jobId: string): Observable<AlertJobStatus> {
    return this.http.get<AlertJobStatus>(buildAlertJobUrl(jobId));
  }

  /** Cantidad máxima de vértices permitidos por polígono al generar un aviso. */
  getMaxPolygonVertices(): Observable<number> {
    const url = buildAlertsLimitsUrl();
    return this.http.get<AlertsLimitsResponse>(url).pipe(map((res) => res.max_vertex_count));
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

  /**
   * Fetches the full pending-alerts list with ETag conditional support.
   * Pending alerts disappear from the list when processed, so callers must
   * always replace their cached list (no incremental since_id fetching).
   */
  getPendingAlerts(etag?: string): Observable<PendingAlertsResult> {
    const url = buildPendingAlertsUrl();
    const headers = etag ? new HttpHeaders({ 'If-None-Match': etag }) : undefined;

    return this.http.get<PendingAlertResponse[]>(url, { headers, observe: 'response' }).pipe(
      map((response): PendingAlertsResult => {
        const alerts = response.body ?? [];
        return {
          kind: 'updated',
          alerts,
          // CORS may hide the ETag header; recompute its documented
          // "<count>-<max_id>" form from the body as a fallback.
          etag: response.headers.get('ETag') ?? computePendingAlertsEtag(alerts),
        };
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 304) {
          return of<PendingAlertsResult>({ kind: 'not-modified' });
        }
        return throwError(() => error);
      }),
    );
  }
}

function computePendingAlertsEtag(alerts: ReadonlyArray<PendingAlertResponse>): string {
  const maxId = alerts.reduce((max, alert) => Math.max(max, alert.alert_id), 0);
  return `"${alerts.length}-${maxId}"`;
}
