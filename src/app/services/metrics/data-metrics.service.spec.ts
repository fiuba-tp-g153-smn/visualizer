import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DataMetricsService } from './data-metrics.service';
import type {
  DataSyncHistoryPoint,
  RedisMemoryResponse,
} from '../../models/metrics/data-metrics.models';

describe('DataMetricsService', () => {
  let service: DataMetricsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DataMetricsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches the redis memory breakdown', () => {
    const payload: RedisMemoryResponse = {
      sampled_at: '2026-06-07T10:00:00+00:00',
      total_keys: 140,
      total_bytes: 1300,
      domains: [{ domain: 'basemap', key_count: 100, memory_bytes: 900 }],
    };
    let result: RedisMemoryResponse | undefined;
    service.getRedisMemory().subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/redis/memory'));
    expect(req.request.method).toBe('GET');
    req.flush(payload);

    expect(result).toEqual(payload);
  });

  it('passes hours, bucket and domain params to sync history', () => {
    const rows: DataSyncHistoryPoint[] = [];
    service.getSyncHistory(24, 'hour', 'satellite').subscribe((r) => (void r));

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/sync/history'));
    expect(req.request.params.get('hours')).toBe('24');
    expect(req.request.params.get('bucket')).toBe('hour');
    expect(req.request.params.get('domain')).toBe('satellite');
    req.flush(rows);
  });

  it('supports the 10min bucket for sync history', () => {
    service.getSyncHistory(6, '10min').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/sync/history'));
    expect(req.request.params.get('hours')).toBe('6');
    expect(req.request.params.get('bucket')).toBe('10min');
    req.flush([]);
  });

  it('omits the domain param when not provided on sync cycles', () => {
    service.getSyncCycles(48).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/sync/cycles'));
    expect(req.request.params.get('hours')).toBe('48');
    expect(req.request.params.get('limit')).toBe('200');
    expect(req.request.params.has('domain')).toBe(false);
    req.flush([]);
  });

  it('sends live=true to redis info when requested', () => {
    service.getRedisInfo(true).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/redis/info'));
    expect(req.request.params.get('live')).toBe('true');
    req.flush({});
  });

  it('requests the basemap providers endpoint', () => {
    service.getBasemapProviders().subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/basemap/providers'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
