import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PendingAlertsService } from './pending-alerts.service';
import { PendingAlertResponse } from '../../models/geo';

const tick = () => new Promise((r) => setTimeout(r, 0));

function pendingAlertResponse(id: number): PendingAlertResponse {
  return {
    alert_id: id,
    phenomenon: 'TORMENTAS',
    area: '<b>BUENOS AIRES:</b> La Matanza.',
    polygon: '[-34.60,-58.50],[-34.70,-58.40],[-34.80,-58.60]',
    gif_gral_url: `/alerts/gral_${id}.gif`,
    gif_area_url: `/alerts/zoom_${id}.gif`,
  };
}

const pendingRequest = (req: { url: string }) => req.url.endsWith('/alerts/pending');
const departmentsRequest = (req: { url: string }) => req.url.endsWith('/intersect/departments');

describe('PendingAlertsService', () => {
  let service: PendingAlertsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PendingAlertsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.setShowPending(false); // stop polling
    httpMock.verify();
  });

  it('fetches the pending list when enabled, without If-None-Match on the first request', async () => {
    service.setShowPending(true);

    const req = httpMock.expectOne(pendingRequest);
    expect(req.request.headers.has('If-None-Match')).toBe(false);
    req.flush([pendingAlertResponse(1)], { headers: { ETag: '"1-1"' } });
    await tick();

    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([1]);
    expect(service.pendingAlerts()[0].departments).toEqual([
      { name: 'La Matanza', province: 'BUENOS AIRES' },
    ]);
  });

  it('sends the stored ETag on refresh and keeps the list on 304', async () => {
    service.setShowPending(true);
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(1)], {
      headers: { ETag: '"1-1"' },
    });
    await tick();

    const refreshPromise = service.refresh();
    const req = httpMock.expectOne(pendingRequest);
    expect(req.request.headers.get('If-None-Match')).toBe('"1-1"');
    req.flush(null, { status: 304, statusText: 'Not Modified' });
    await refreshPromise;

    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([1]);
  });

  it('computes the ETag from the body when the header is not exposed', async () => {
    service.setShowPending(true);
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(1), pendingAlertResponse(4)]);
    await tick();

    const refreshPromise = service.refresh();
    const req = httpMock.expectOne(pendingRequest);
    expect(req.request.headers.get('If-None-Match')).toBe('"2-4"');
    req.flush(null, { status: 304, statusText: 'Not Modified' });
    await refreshPromise;
  });

  it('replaces the list on 200 so processed alerts disappear', async () => {
    service.setShowPending(true);
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(1), pendingAlertResponse(2)]);
    await tick();
    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([1, 2]);

    // Alert 1 was processed (became active): it is gone from the new snapshot.
    const refreshPromise = service.refresh();
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(2)]);
    await refreshPromise;

    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([2]);
  });

  it('refreshNow enables the emitted view and fetches the fresh list', async () => {
    expect(service.showPending()).toBe(false);

    await service.refreshNow();

    expect(service.showPending()).toBe(true);
    const req = httpMock.expectOne(pendingRequest);
    expect(req.request.headers.has('If-None-Match')).toBe(false);
    req.flush([pendingAlertResponse(5)]);
    await tick();
    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([5]);
  });

  it('refreshNow ignores the cached ETag when already enabled', async () => {
    service.setShowPending(true);
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(1)], {
      headers: { ETag: '"1-1"' },
    });
    await tick();

    const refreshPromise = service.refreshNow();
    const req = httpMock.expectOne(pendingRequest);
    // ETag was cleared, so the forced refresh is unconditional (no If-None-Match).
    expect(req.request.headers.has('If-None-Match')).toBe(false);
    req.flush([pendingAlertResponse(1), pendingAlertResponse(2)]);
    await refreshPromise;

    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([1, 2]);
  });

  it('discards a stale snapshot fetched before a forced refresh', async () => {
    service.setShowPending(true);
    const staleReq = httpMock.expectOne(pendingRequest);

    // A forced refresh starts while the first fetch is still in flight.
    const refreshPromise = service.refreshNow();
    const freshReq = httpMock.expectOne(pendingRequest);
    freshReq.flush([pendingAlertResponse(9)]);
    await refreshPromise;

    // The stale snapshot (taken before the refresh) must not clobber the fresh one.
    staleReq.flush([pendingAlertResponse(1)]);
    await tick();

    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([9]);
  });

  it('hides the departments overlay when the shown alert is processed and disappears from a refresh', async () => {
    service.setShowPending(true);
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(1)]);
    await tick();

    const showPromise = service.showDepartments(service.pendingAlerts()[0]);
    httpMock.expectOne(departmentsRequest).flush({ departments: [] });
    await showPromise;
    expect(service.shownDepartmentsAlert()?.alertId).toBe(1);

    const refreshPromise = service.refresh();
    httpMock.expectOne(pendingRequest).flush([]); // alert 1 was processed (became active)
    await refreshPromise;

    expect(service.shownDepartmentsAlert()).toBeNull();
  });

  it('discards a stale departments response if the shown alert changed meanwhile', async () => {
    service.setShowPending(true);
    httpMock
      .expectOne(pendingRequest)
      .flush([pendingAlertResponse(1), pendingAlertResponse(2)]);
    await tick();
    const [alert1, alert2] = service.pendingAlerts();

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

  it('clears state when disabled', async () => {
    service.setShowPending(true);
    httpMock.expectOne(pendingRequest).flush([pendingAlertResponse(1)]);
    await tick();
    service.toggleHidden(1);
    expect(service.pendingAlerts().length).toBe(1);

    service.setShowPending(false);
    expect(service.pendingAlerts()).toEqual([]);
    expect(service.hiddenIds().size).toBe(0);
    expect(service.showPending()).toBe(false);
  });
});
