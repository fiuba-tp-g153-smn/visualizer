import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  buildJobsUrl,
  buildLiveUrl,
  buildSummaryUrl,
  buildThroughputUrl,
  buildTimeSeriesUrl,
} from '../../config/metrics.config';
import type {
  Bucket,
  JobOutcome,
  JobTypeSummary,
  LiveStatus,
  RecentJob,
  ThroughputBucket,
  TimingSeriesPoint,
} from '../../models/metrics/metrics.models';

/** Filtros opcionales para la consulta de trabajos recientes. */
export interface JobsQuery {
  readonly limit: number;
  readonly offset: number;
  readonly type?: string;
  readonly outcome?: JobOutcome;
}

/**
 * Cliente del API de métricas del tiles-processor. Es de solo lectura: cada
 * método mapea a un endpoint `GET /api/*`. Las respuestas se tipan con los
 * modelos del wire (sin adaptación), igual que el resto de servicios HTTP.
 */
@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);

  /** Estadísticas agregadas por tipo de trabajo en la ventana dada. */
  getSummary(hours: number): Observable<JobTypeSummary[]> {
    const params = new HttpParams().set('hours', hours);
    return this.http.get<JobTypeSummary[]>(buildSummaryUrl(), { params });
  }

  /** Trabajos finalizados recientes, del más nuevo al más viejo. */
  getJobs(query: JobsQuery): Observable<RecentJob[]> {
    let params = new HttpParams().set('limit', query.limit).set('offset', query.offset);
    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.outcome) {
      params = params.set('outcome', query.outcome);
    }
    return this.http.get<RecentJob[]>(buildJobsUrl(), { params });
  }

  /** Conteo de trabajos por intervalo y tipo. */
  getThroughput(bucket: Bucket | '10min', hours: number): Observable<ThroughputBucket[]> {
    const params = new HttpParams().set('bucket', bucket).set('hours', hours);
    return this.http.get<ThroughputBucket[]>(buildThroughputUrl(), { params });
  }

  /** Series temporales de tiempos (prom/p95/etapas), solo trabajos exitosos. */
  getTimeSeries(bucket: Bucket, hours: number): Observable<TimingSeriesPoint[]> {
    const params = new HttpParams().set('bucket', bucket).set('hours', hours);
    return this.http.get<TimingSeriesPoint[]>(buildTimeSeriesUrl(), { params });
  }

  /** Estado en vivo: profundidad de colas y trabajos en proceso. */
  getLive(): Observable<LiveStatus> {
    return this.http.get<LiveStatus>(buildLiveUrl());
  }
}
