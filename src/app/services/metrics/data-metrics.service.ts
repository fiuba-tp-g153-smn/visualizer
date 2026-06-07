import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  buildDataBasemapProvidersUrl,
  buildDataRedisInfoHistoryUrl,
  buildDataRedisInfoUrl,
  buildDataRedisMemoryHistoryUrl,
  buildDataRedisMemoryUrl,
  buildDataSummaryUrl,
  buildDataSyncCyclesUrl,
  buildDataSyncHistoryUrl,
  buildDataSyncStatusUrl,
} from '../../config/data-metrics.config';
import type {
  BasemapProviderStatus,
  DataMetricsSummary,
  DataSyncCycle,
  DataSyncHistoryPoint,
  DataSyncStatus,
  RedisInfo,
  RedisMemoryHistoryPoint,
  RedisMemoryResponse,
  SyncBucket,
} from '../../models/metrics/data-metrics.models';

/** Cliente HTTP del panel de estado/rendimiento del data-service. */
@Injectable({ providedIn: 'root' })
export class DataMetricsService {
  private readonly http = inject(HttpClient);

  getSummary(): Observable<DataMetricsSummary> {
    return this.http.get<DataMetricsSummary>(buildDataSummaryUrl());
  }

  getSyncStatus(): Observable<DataSyncStatus> {
    return this.http.get<DataSyncStatus>(buildDataSyncStatusUrl());
  }

  getSyncHistory(
    hours: number,
    bucket: SyncBucket,
    domain?: string,
  ): Observable<DataSyncHistoryPoint[]> {
    let params = new HttpParams().set('hours', hours).set('bucket', bucket);
    if (domain) {
      params = params.set('domain', domain);
    }
    return this.http.get<DataSyncHistoryPoint[]>(buildDataSyncHistoryUrl(), { params });
  }

  getSyncCycles(hours: number, domain?: string, limit = 200): Observable<DataSyncCycle[]> {
    let params = new HttpParams().set('hours', hours).set('limit', limit);
    if (domain) {
      params = params.set('domain', domain);
    }
    return this.http.get<DataSyncCycle[]>(buildDataSyncCyclesUrl(), { params });
  }

  getRedisMemory(): Observable<RedisMemoryResponse> {
    return this.http.get<RedisMemoryResponse>(buildDataRedisMemoryUrl());
  }

  getRedisMemoryHistory(
    hours: number,
    domain?: string,
  ): Observable<RedisMemoryHistoryPoint[]> {
    let params = new HttpParams().set('hours', hours);
    if (domain) {
      params = params.set('domain', domain);
    }
    return this.http.get<RedisMemoryHistoryPoint[]>(buildDataRedisMemoryHistoryUrl(), {
      params,
    });
  }

  getRedisInfo(live = false): Observable<RedisInfo> {
    const params = new HttpParams().set('live', live);
    return this.http.get<RedisInfo>(buildDataRedisInfoUrl(), { params });
  }

  getRedisInfoHistory(hours: number): Observable<RedisInfo[]> {
    const params = new HttpParams().set('hours', hours);
    return this.http.get<RedisInfo[]>(buildDataRedisInfoHistoryUrl(), { params });
  }

  getBasemapProviders(): Observable<BasemapProviderStatus[]> {
    return this.http.get<BasemapProviderStatus[]>(buildDataBasemapProvidersUrl());
  }
}
