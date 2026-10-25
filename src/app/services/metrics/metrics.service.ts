import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  buildJobUrl,
  buildJobsUrl,
  buildLiveUrl,
  buildSummaryUrl,
  buildThroughputUrl,
  buildTimelineUrl,
  buildTimeSeriesUrl,
} from '../../config/metrics.config';
import type {
  Bucket,
  JobOutcome,
  JobTypeSummary,
  LiveStatus,
  RecentJob,
  ThroughputBucket,
  TimelinePayload,
  TimingSeriesPoint,
} from '../../models/metrics/metrics.models';
import { decodeTimeline } from './timeline-codec.util';

export interface JobsQuery {
  readonly limit: number;
  readonly offset: number;
  readonly type?: string;
  readonly outcome?: JobOutcome;
  /** Lookback window in hours; omitted = all time (for the timeline section). */
  readonly hours?: number;
  /** ISO8601 lower bound (finished_at >= since); overrides `hours`. */
  readonly since?: string;
  /** ISO8601 upper bound (finished_at < before); for the timeline's lazy windows. */
  readonly before?: string;
}

/** Ventana de la línea de tiempo: `hours` u otra cota `since` (obligatoria una de las dos). */
export interface TimelineQuery {
  readonly hours?: number;
  /** ISO8601 lower bound (finished_at >= since); overrides `hours`. */
  readonly since?: string;
  /** ISO8601 upper bound (finished_at < before); for the lazy 'all' windows. */
  readonly before?: string;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);

  getSummary(hours: number): Observable<JobTypeSummary[]> {
    const params = new HttpParams().set('hours', hours);
    return this.http.get<JobTypeSummary[]>(buildSummaryUrl(), { params });
  }

  getJobs(query: JobsQuery): Observable<RecentJob[]> {
    let params = new HttpParams().set('limit', query.limit).set('offset', query.offset);
    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.outcome) {
      params = params.set('outcome', query.outcome);
    }
    if (query.hours != null) {
      params = params.set('hours', query.hours);
    }
    if (query.since) {
      params = params.set('since', query.since);
    }
    if (query.before) {
      params = params.set('before', query.before);
    }
    return this.http.get<RecentJob[]>(buildJobsUrl(), { params });
  }

  /** Un trabajo completo por id (detalle desde la línea de tiempo). */
  getJob(id: number): Observable<RecentJob> {
    return this.http.get<RecentJob>(buildJobUrl(id));
  }

  /** Trabajos de la ventana en formato compacto, ya decodificados a `RecentJob`. */
  getTimeline(query: TimelineQuery): Observable<RecentJob[]> {
    let params = new HttpParams();
    if (query.hours != null) {
      params = params.set('hours', query.hours);
    }
    if (query.since) {
      params = params.set('since', query.since);
    }
    if (query.before) {
      params = params.set('before', query.before);
    }
    return this.http
      .get<TimelinePayload>(buildTimelineUrl(), { params })
      .pipe(map((payload) => decodeTimeline(payload)));
  }

  getThroughput(bucket: Bucket | '10min', hours: number): Observable<ThroughputBucket[]> {
    const params = new HttpParams().set('bucket', bucket).set('hours', hours);
    return this.http.get<ThroughputBucket[]>(buildThroughputUrl(), { params });
  }

  getTimeSeries(bucket: Bucket, hours: number): Observable<TimingSeriesPoint[]> {
    const params = new HttpParams().set('bucket', bucket).set('hours', hours);
    return this.http.get<TimingSeriesPoint[]>(buildTimeSeriesUrl(), { params });
  }

  getLive(): Observable<LiveStatus> {
    return this.http.get<LiveStatus>(buildLiveUrl());
  }
}
