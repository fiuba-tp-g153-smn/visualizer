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
    service.getJobs({ limit: 50, offset: 50, type: 'radar_DBZH', outcome: 'dlq' }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/jobs'));
    expect(req.request.params.get('type')).toBe('radar_DBZH');
    expect(req.request.params.get('outcome')).toBe('dlq');
    req.flush([]);
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
