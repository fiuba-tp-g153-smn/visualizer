import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  buildAlertsJobsHistoryUrl,
  buildAlertsJobsUrl,
  buildAlertsLayersUrl,
  buildAlertsProcessorHistoryUrl,
  buildAlertsSummaryUrl,
} from '../../config/alerts-metrics.config';
import type {
  AlertJobMetric,
  AlertsJobHistoryPoint,
  AlertsLayerRun,
  AlertsProcessorSample,
  AlertsSummary,
} from '../../models/metrics/alerts-metrics.models';

/** Cliente HTTP del API de métricas del alerts-service (panel "Alertas"). */
@Injectable({ providedIn: 'root' })
export class AlertsMetricsService {
  private readonly http = inject(HttpClient);

  getSummary(hours: number): Observable<AlertsSummary> {
    const params = new HttpParams().set('hours', hours);
    return this.http.get<AlertsSummary>(buildAlertsSummaryUrl(), { params });
  }

  getJobs(hours: number, limit = 200): Observable<AlertJobMetric[]> {
    const params = new HttpParams().set('hours', hours).set('limit', limit);
    return this.http.get<AlertJobMetric[]>(buildAlertsJobsUrl(), { params });
  }

  getJobsHistory(hours: number, bucket: 'hour' | 'day'): Observable<AlertsJobHistoryPoint[]> {
    const params = new HttpParams().set('hours', hours).set('bucket', bucket);
    return this.http.get<AlertsJobHistoryPoint[]>(buildAlertsJobsHistoryUrl(), { params });
  }

  getProcessorHistory(hours: number): Observable<AlertsProcessorSample[]> {
    const params = new HttpParams().set('hours', hours);
    return this.http.get<AlertsProcessorSample[]>(buildAlertsProcessorHistoryUrl(), { params });
  }

  getLayers(limit = 20): Observable<AlertsLayerRun[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<AlertsLayerRun[]>(buildAlertsLayersUrl(), { params });
  }
}
