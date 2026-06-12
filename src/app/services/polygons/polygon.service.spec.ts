import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PolygonService } from './polygon.service';
import { GenerateAlertsResponse } from './department-intersection.service';
import { STORAGE_KEYS } from '../../constants';

const COORDINATES: Array<[number, number]> = [
  [-34.6, -58.5],
  [-34.7, -58.4],
  [-34.8, -58.6],
];

function generateAlertsResponse(id: number): GenerateAlertsResponse {
  return {
    alert_id: id,
    timestamp: '260611120000',
    phenomenon_code: 10,
    phenomenon: 'TORMENTAS',
    area: '<b>BUENOS AIRES:</b> La Matanza.',
    polygon: '[-34.60,-58.50],[-34.70,-58.40],[-34.80,-58.60]',
    gif_area_url: `/alerts/zoom_${id}.gif`,
    gif_gral_url: `/alerts/gral_${id}.gif`,
    affected_departments_count: 1,
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
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('deletes the draft and returns the pending alert when emission succeeds', async () => {
    const polygon = service.createPolygon({ name: 'Test', coordinates: COORDINATES });

    const resultPromise = service.generateAlerts(polygon.id, 10);
    httpMock.expectOne(generateRequest).flush(generateAlertsResponse(7));
    const result = await resultPromise;

    expect(result).not.toBeNull();
    expect(result?.alertId).toBe(7);
    expect(result?.gifAreaUrl).toContain('/alerts/zoom_7.gif');
    expect(service.allPolygons()).toEqual([]);
  });

  it('keeps the draft and returns null when emission fails', async () => {
    const polygon = service.createPolygon({ name: 'Test', coordinates: COORDINATES });

    const resultPromise = service.generateAlerts(polygon.id, 10);
    httpMock
      .expectOne(generateRequest)
      .flush({ detail: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(service.allPolygons().map((p) => p.id)).toEqual([polygon.id]);
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

    expect(reloaded.allPolygons().map((p) => p.id)).toEqual(['draft']);
  });
});
