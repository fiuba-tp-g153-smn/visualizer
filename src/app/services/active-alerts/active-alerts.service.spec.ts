import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ActiveAlertsService } from './active-alerts.service';
import { ActiveAlertResponse } from '../../models/geo';

const tick = () => new Promise((r) => setTimeout(r, 0));

const futureIso = (): string => new Date(Date.now() + 3 * 3_600_000).toISOString();
const pastIso = (): string => new Date(Date.now() - 3_600_000).toISOString();

function activeAlert(id: number, end: string): ActiveAlertResponse {
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
const departmentsRequest = (req: { url: string }) => req.url.endsWith('/intersect/departments');

describe('ActiveAlertsService', () => {
  let service: ActiveAlertsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ActiveAlertsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.setShowActive(false); // stop polling
    httpMock.verify();
    vi.useRealTimers();
  });

  it('fetches all active alerts when enabled and prunes expired ones', async () => {
    service.setShowActive(true);

    const req = httpMock.expectOne(alertsRequest);
    expect(req.request.params.has('since_id')).toBe(false);
    req.flush([activeAlert(1, futureIso()), activeAlert(2, pastIso())]); // id 2 already expired
    await tick();

    expect(service.activeAlerts().map((a) => a.alertId)).toEqual([1]);
  });

  it('refresh uses since_id with the highest seen id and merges new alerts', async () => {
    service.setShowActive(true);
    httpMock.expectOne(alertsRequest).flush([activeAlert(1, futureIso())]);
    await tick();

    const refreshPromise = service.refresh();
    const req = httpMock.expectOne(alertsRequest);
    expect(req.request.params.get('since_id')).toBe('1');
    req.flush([activeAlert(2, futureIso())]);
    await refreshPromise;
    await tick();

    expect(service.activeAlerts().map((a) => a.alertId)).toEqual([1, 2]);
  });

  it('clears the list when disabled', async () => {
    service.setShowActive(true);
    httpMock.expectOne(alertsRequest).flush([activeAlert(1, futureIso())]);
    await tick();
    expect(service.activeAlerts().length).toBe(1);

    service.setShowActive(false);
    expect(service.activeAlerts()).toEqual([]);
    expect(service.showActive()).toBe(false);
  });

  it('hides the departments overlay when the shown alert expires on refresh', async () => {
    vi.useFakeTimers();
    service.setShowActive(true);
    httpMock
      .expectOne(alertsRequest)
      .flush([activeAlert(1, new Date(Date.now() + 1_000).toISOString())]);
    await vi.advanceTimersByTimeAsync(0);

    const showPromise = service.showDepartments(service.activeAlerts()[0]);
    httpMock.expectOne(departmentsRequest).flush({ departments: [] });
    await showPromise;
    expect(service.shownDepartmentsAlert()?.alertId).toBe(1);

    vi.setSystemTime(Date.now() + 2_000); // alert 1 is now expired
    const refreshPromise = service.refresh();
    httpMock.expectOne(alertsRequest).flush([]);
    await refreshPromise;

    expect(service.shownDepartmentsAlert()).toBeNull();
  });

  it('discards a stale departments response if the shown alert changed meanwhile', async () => {
    service.setShowActive(true);
    httpMock
      .expectOne(alertsRequest)
      .flush([activeAlert(1, futureIso()), activeAlert(2, futureIso())]);
    await tick();
    const [alert1, alert2] = service.activeAlerts();

    const firstShowPromise = service.showDepartments(alert1);
    const firstReq = httpMock.expectOne(departmentsRequest);

    // The user switches to alert 2 before alert 1's request resolves.
    const secondShowPromise = service.showDepartments(alert2);
    const secondReq = httpMock.expectOne(departmentsRequest);
    secondReq.flush({ departments: [{ properties: { nam: 'Dept2' }, geometry: {}, intersection: {} }] });
    await secondShowPromise;

    firstReq.flush({ departments: [{ properties: { nam: 'Dept1' }, geometry: {}, intersection: {} }] });
    await firstShowPromise;

    expect(service.shownDepartmentsAlert()?.alertId).toBe(2);
    expect(service.shownDepartments().map((d) => d.name)).toEqual(['Dept2']);
  });
});
