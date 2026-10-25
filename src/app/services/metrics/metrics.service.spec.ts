import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MetricsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getSummary calls /api/summary with the hours param', () => {
    service.getSummary(24).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/summary'));
    expect(req.request.params.get('hours')).toBe('24');
    req.flush([]);
  });

  it('getJobs sends limit/offset and omits optional filters when absent', () => {
    service.getJobs({ limit: 50, offset: 0 }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/jobs'));
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('offset')).toBe('0');
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.has('outcome')).toBe(false);
    req.flush([]);
  });

  it('getJobs includes type and outcome when provided', () => {
    service
      .getJobs({ limit: 50, offset: 50, type: 'radar_sinarame_dbzh', outcome: 'dlq' })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/jobs'));
    expect(req.request.params.get('type')).toBe('radar_sinarame_dbzh');
    expect(req.request.params.get('outcome')).toBe('dlq');
    req.flush([]);
  });

  it('getTimeline sends the window and decodes the columnar payload', () => {
    let ids: number[] = [];
    service
      .getTimeline({ since: '2026-06-01T00:00:00Z', before: '2026-06-08T00:00:00Z' })
      .subscribe((jobs) => (ids = jobs.map((j) => j.id)));
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/timeline'));
    expect(req.request.params.get('since')).toBe('2026-06-01T00:00:00Z');
    expect(req.request.params.get('before')).toBe('2026-06-08T00:00:00Z');
    expect(req.request.params.has('hours')).toBe(false);
    req.flush({
      v: 1,
      t0: 0,
      types: ['t'],
      labels: ['T'],
      outcomes: ['success'],
      workers: [null],
      id: [5, 1],
      type: [0, 0],
      outcome: [0, 0],
      worker: [0, 0],
      start: [0, 10],
      dur: [1, 1],
    });
    expect(ids).toEqual([5, 6]);
  });

  it('getTimeline passes hours for fixed ranges', () => {
    service.getTimeline({ hours: 24 }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/timeline'));
    expect(req.request.params.get('hours')).toBe('24');
    req.flush({
      v: 1,
      t0: null,
      types: [],
      labels: [],
      outcomes: [],
      workers: [],
      id: [],
      type: [],
      outcome: [],
      worker: [],
      start: [],
      dur: [],
    });
  });

  it('getJob calls /api/jobs/{id}', () => {
    service.getJob(42).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/api/jobs/42')).flush({});
  });

  it('getThroughput passes bucket and hours', () => {
    service.getThroughput('10min', 6).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/throughput'));
    expect(req.request.params.get('bucket')).toBe('10min');
    expect(req.request.params.get('hours')).toBe('6');
    req.flush([]);
  });

  it('getTimeSeries passes bucket and hours', () => {
    service.getTimeSeries('hour', 24).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/timeseries'));
    expect(req.request.params.get('bucket')).toBe('hour');
    req.flush([]);
  });

  it('getLive calls /api/live', () => {
    service.getLive().subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/api/live')).flush({ queues: {}, in_progress: [] });
  });
});
