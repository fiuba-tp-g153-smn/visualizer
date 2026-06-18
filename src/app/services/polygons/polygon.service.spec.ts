import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PolygonService } from './polygon.service';
import { AlertJobAccepted } from './department-intersection.service';
import { STORAGE_KEYS } from '../../constants';
import { LatLng } from '../../models/geo';
import { NotificationService } from '../notifications/notification.service';

const COORDINATES: Array<LatLng> = [
  [-34.6, -58.5],
  [-34.7, -58.4],
  [-34.8, -58.6],
];

function alertJobAccepted(jobId: string): AlertJobAccepted {
  return {
    job_id: jobId,
    phenomenon_code: 10,
    phenomenon: 'TORMENTAS',
    polygon: '[-34.60,-58.50],[-34.70,-58.40],[-34.80,-58.60]',
  };
}

const generateRequest = (req: { url: string; method: string }) =>
  req.method === 'POST' && req.url.endsWith('/alerts');

describe('PolygonService', () => {
  let service: PolygonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PolygonService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne((req) => req.url.endsWith('/alerts/limits')).flush({ max_vertex_count: 100 });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('returns the accepted job and keeps the draft while it generates', async () => {
    const polygon = service.createPolygon({ name: 'Test', coordinates: COORDINATES });

    const resultPromise = service.generateAlerts(polygon.id, 10);
    httpMock
      .expectOne(generateRequest)
      .flush(alertJobAccepted('job-7'), { status: 202, statusText: 'Accepted' });
    const result = await resultPromise;

    expect(result?.job_id).toBe('job-7');
    // The draft is deleted only once the job completes (via finishEmission).
    expect(service.allPolygons().map((p) => p.id)).toEqual([polygon.id]);
    expect(service.isAlertsLoading(polygon.id)).toBe(true);
  });

  it('keeps the draft and returns null when the request fails', async () => {
    const polygon = service.createPolygon({ name: 'Test', coordinates: COORDINATES });

    const resultPromise = service.generateAlerts(polygon.id, 10);
    httpMock
      .expectOne(generateRequest)
      .flush({ detail: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(service.allPolygons().map((p) => p.id)).toEqual([polygon.id]);
    expect(service.isAlertsLoading(polygon.id)).toBe(false);
  });

  it('finishEmission deletes the draft and clears loading', () => {
    const polygon = service.createPolygon({ name: 'Test', coordinates: COORDINATES });

    service.finishEmission(polygon.id);

    expect(service.allPolygons()).toEqual([]);
    expect(service.isAlertsLoading(polygon.id)).toBe(false);
  });

  it('persists the job id on the draft once accepted, and clears it on cancelEmission', async () => {
    const polygon = service.createPolygon({ name: 'Test', coordinates: COORDINATES });

    const resultPromise = service.generateAlerts(polygon.id, 10);
    httpMock
      .expectOne(generateRequest)
      .flush(alertJobAccepted('job-7'), { status: 202, statusText: 'Accepted' });
    await resultPromise;

    expect(service.getPolygonById(polygon.id)?.jobId).toBe('job-7');
    expect(service.getResumableJobs()).toEqual([{ id: polygon.id, jobId: 'job-7' }]);

    service.cancelEmission(polygon.id);

    expect(service.getPolygonById(polygon.id)?.jobId).toBeUndefined();
    expect(service.getResumableJobs()).toEqual([]);
  });

  it('keeps a submitting draft blocked and resumable on reload when it has a job id', () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      STORAGE_KEYS.POLYGONS,
      JSON.stringify([
        {
          id: 'draft',
          name: 'Draft',
          coordinates: COORDINATES,
          visible: true,
          createdAt: now,
          updatedAt: now,
          status: 'submitting',
          jobId: 'job-9',
        },
      ]),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const reloaded = TestBed.inject(PolygonService);
    const reloadedHttpMock = TestBed.inject(HttpTestingController);
    reloadedHttpMock.expectOne((req) => req.url.endsWith('/alerts/limits')).flush({ max_vertex_count: 100 });

    expect(reloaded.isAlertsLoading('draft')).toBe(true);
    expect(reloaded.getResumableJobs()).toEqual([{ id: 'draft', jobId: 'job-9' }]);
  });

  it('silently reverts an orphan submitting draft (no job id) on reload', () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      STORAGE_KEYS.POLYGONS,
      JSON.stringify([
        {
          id: 'draft',
          name: 'Draft',
          coordinates: COORDINATES,
          visible: true,
          createdAt: now,
          updatedAt: now,
          status: 'submitting',
        },
      ]),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const reloaded = TestBed.inject(PolygonService);
    const reloadedHttpMock = TestBed.inject(HttpTestingController);
    reloadedHttpMock.expectOne((req) => req.url.endsWith('/alerts/limits')).flush({ max_vertex_count: 100 });
    const notifications = TestBed.inject(NotificationService);

    expect(reloaded.isAlertsLoading('draft')).toBe(false);
    expect(reloaded.getPolygonById('draft')?.status).toBeUndefined();
    expect(reloaded.getResumableJobs()).toEqual([]);
    expect(notifications.notifications()).toEqual([]);
  });

  it('drops legacy emitted polygons (with alerts) from storage on load', () => {
    const now = new Date().toISOString();
    const base = {
      coordinates: COORDINATES,
      visible: true,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(
      STORAGE_KEYS.POLYGONS,
      JSON.stringify([
        { ...base, id: 'draft', name: 'Draft' },
        { ...base, id: 'emitted', name: 'Emitted', alerts: { alertId: 1 } },
      ]),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const reloaded = TestBed.inject(PolygonService);
    const reloadedHttpMock = TestBed.inject(HttpTestingController);
    reloadedHttpMock.expectOne((req) => req.url.endsWith('/alerts/limits')).flush({ max_vertex_count: 100 });

    expect(reloaded.allPolygons().map((p) => p.id)).toEqual(['draft']);
  });
});
