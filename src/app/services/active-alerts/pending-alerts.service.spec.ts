import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PendingAlertsService } from './pending-alerts.service';
import { PendingAlert, PendingAlertResponse } from '../../models/geo';

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

function pendingAlert(id: number): PendingAlert {
  return {
    alertId: id,
    phenomenon: 'TORMENTAS',
    departments: [{ name: 'La Matanza', province: 'BUENOS AIRES' }],
    coordinates: [
      [-34.6, -58.5],
      [-34.7, -58.4],
      [-34.8, -58.6],
    ],
    gifGralUrl: `http://localhost/alerts/gral_${id}.gif`,
    gifAreaUrl: `http://localhost/alerts/zoom_${id}.gif`,
  };
}

const pendingRequest = (req: { url: string }) => req.url.endsWith('/alerts/pending');

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

  it('addEmitted inserts the alert immediately and enables the emitted view', async () => {
    expect(service.showPending()).toBe(false);

    service.addEmitted(pendingAlert(5));

    expect(service.showPending()).toBe(true);
    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([5]);

    // Enabling triggers an immediate authoritative fetch.
    const req = httpMock.expectOne(pendingRequest);
    req.flush([pendingAlertResponse(5)]);
    await tick();
    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([5]);
  });

  it('discards a stale snapshot fetched before the latest emission', async () => {
    service.setShowPending(true);
    const staleReq = httpMock.expectOne(pendingRequest);

    // Emission happens while the first fetch is still in flight.
    service.addEmitted(pendingAlert(9));
    await tick();

    // The stale snapshot (taken before the emission) does not contain #9 and
    // must not drop it from the list.
    staleReq.flush([]);
    await tick();

    expect(service.pendingAlerts().map((a) => a.alertId)).toEqual([9]);
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
