import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AvisosService } from './avisos.service';
import { AvisoResponse } from '../../models/geo';

const tick = () => new Promise((r) => setTimeout(r, 0));

const futureIso = (): string => new Date(Date.now() + 3 * 3_600_000).toISOString();
const pastIso = (): string => new Date(Date.now() - 3_600_000).toISOString();

function aviso(id: number, end: string): AvisoResponse {
  return {
    alert_id: id,
    phenomenon: 'TORMENTAS',
    area: '<b>BUENOS AIRES:</b> La Matanza.',
    polygon: '[-34.60,-58.50],[-34.70,-58.40],[-34.80,-58.60]',
    start_datetime: pastIso(),
    end_datetime: end,
  };
}

const alertsRequest = (req: { url: string }) => req.url.endsWith('/alerts');

describe('AvisosService', () => {
  let service: AvisosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AvisosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.setShowActive(false); // stop polling
    httpMock.verify();
  });

  it('fetches all active avisos when enabled and prunes expired ones', async () => {
    service.setShowActive(true);

    const req = httpMock.expectOne(alertsRequest);
    expect(req.request.params.has('since_id')).toBe(false);
    req.flush([aviso(1, futureIso()), aviso(2, pastIso())]); // id 2 already expired
    await tick();

    expect(service.avisos().map((a) => a.alertId)).toEqual([1]);
  });

  it('refresh uses since_id with the highest seen id and merges new avisos', async () => {
    service.setShowActive(true);
    httpMock.expectOne(alertsRequest).flush([aviso(1, futureIso())]);
    await tick();

    const refreshPromise = service.refresh();
    const req = httpMock.expectOne(alertsRequest);
    expect(req.request.params.get('since_id')).toBe('1');
    req.flush([aviso(2, futureIso())]);
    await refreshPromise;
    await tick();

    expect(service.avisos().map((a) => a.alertId)).toEqual([1, 2]);
  });

  it('clears the list when disabled', async () => {
    service.setShowActive(true);
    httpMock.expectOne(alertsRequest).flush([aviso(1, futureIso())]);
    await tick();
    expect(service.avisos().length).toBe(1);

    service.setShowActive(false);
    expect(service.avisos()).toEqual([]);
    expect(service.showActive()).toBe(false);
  });
});
