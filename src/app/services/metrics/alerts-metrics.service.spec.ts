import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AlertsMetricsService } from './alerts-metrics.service';

describe('AlertsMetricsService', () => {
  let service: AlertsMetricsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AlertsMetricsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getSummary calls /metrics/summary with the hours window', () => {
    service.getSummary(24).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/summary'));
    expect(req.request.params.get('hours')).toBe('24');
    req.flush({ window_hours: 24, jobs: {}, processor: {} });
  });

  it('getJobs passes hours and limit', () => {
    service.getJobs(168, 50).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/jobs'));
    expect(req.request.params.get('hours')).toBe('168');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush([]);
  });

  it('getJobsHistory passes the bucket', () => {
    service.getJobsHistory(24, 'hour').subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/jobs/history'));
    expect(req.request.params.get('bucket')).toBe('hour');
    req.flush([]);
  });

  it('getProcessorHistory calls /metrics/processor/history', () => {
    service.getProcessorHistory(24).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/metrics/processor/history')).flush([]);
  });

  it('getLayers passes the limit', () => {
    service.getLayers(20).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/metrics/layers'));
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([]);
  });
});
