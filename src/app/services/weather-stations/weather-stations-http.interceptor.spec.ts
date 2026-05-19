import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { NotificationType } from '../../models';
import { NotificationService } from '../notifications/notification.service';
import { WeatherStationsApiKeyService } from './weather-stations-api-key.service';
import { weatherStationsHttpInterceptor } from './weather-stations-http.interceptor';

const WS_URL = 'http://localhost:6006/weather-stations/tilesets';
const OTHER_URL = 'http://localhost:6006/basemap/argenmap/1/2/3.png';

function configure(
  apiKeyOverrides: Partial<WeatherStationsApiKeyService> = {},
  notificationOverrides: Partial<NotificationService> = {},
) {
  const apiKeyMock: Partial<WeatherStationsApiKeyService> = {
    getKey: vi.fn().mockReturnValue('initial-key'),
    handleUnauthorized: vi.fn().mockResolvedValue(null),
    ...apiKeyOverrides,
  };
  const notificationMock: Partial<NotificationService> = {
    show: vi.fn().mockReturnValue('id'),
    ...notificationOverrides,
  };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([weatherStationsHttpInterceptor])),
      provideHttpClientTesting(),
      { provide: WeatherStationsApiKeyService, useValue: apiKeyMock },
      { provide: NotificationService, useValue: notificationMock },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    httpMock: TestBed.inject(HttpTestingController),
    apiKey: apiKeyMock,
    notification: notificationMock,
  };
}

describe('weatherStationsHttpInterceptor', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('injects X-API-Key on /weather-stations/* requests', async () => {
    const { http, httpMock } = configure();
    const inflight = firstValueFrom(http.get(WS_URL));
    const req = httpMock.expectOne(WS_URL);
    expect(req.request.headers.get('X-API-Key')).toBe('initial-key');
    req.flush({ tilesets: [] });
    await inflight;
    httpMock.verify();
  });

  it('does not touch requests outside /weather-stations/', async () => {
    const { http, httpMock } = configure();
    const inflight = firstValueFrom(http.get(OTHER_URL, { responseType: 'blob' }));
    const req = httpMock.expectOne(OTHER_URL);
    expect(req.request.headers.has('X-API-Key')).toBe(false);
    req.flush(new Blob(['x']));
    await inflight;
    httpMock.verify();
  });

  it('does not inject the header when no key is stored', async () => {
    const { http, httpMock } = configure({ getKey: vi.fn().mockReturnValue(null) });
    const inflight = firstValueFrom(http.get(WS_URL));
    const req = httpMock.expectOne(WS_URL);
    expect(req.request.headers.has('X-API-Key')).toBe(false);
    req.flush({ tilesets: [] });
    await inflight;
    httpMock.verify();
  });

  it('on 401 re-prompts and retries with the new key', async () => {
    const { http, httpMock, apiKey, notification } = configure({
      getKey: vi.fn().mockReturnValue('bad-key'),
      handleUnauthorized: vi.fn().mockResolvedValue('good-key'),
    });

    const inflight = firstValueFrom(http.get<{ tilesets: unknown[] }>(WS_URL));

    const first = httpMock.expectOne(WS_URL);
    expect(first.request.headers.get('X-API-Key')).toBe('bad-key');
    first.flush(
      { detail: 'Invalid or missing X-API-Key header' },
      { status: 401, statusText: 'Unauthorized' },
    );

    // Let the microtask queue drain so handleUnauthorized's resolved Promise
    // propagates and the retry is issued.
    await Promise.resolve();
    await Promise.resolve();

    const retry = httpMock.expectOne(WS_URL);
    expect(retry.request.headers.get('X-API-Key')).toBe('good-key');
    retry.flush({ tilesets: [] });

    await inflight;
    expect(apiKey.handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(notification.show).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('on 401 + user cancel shows an auto-dismissing notification and re-throws', async () => {
    const { http, httpMock, apiKey, notification } = configure({
      handleUnauthorized: vi.fn().mockResolvedValue(null),
    });

    const inflight = firstValueFrom(http.get(WS_URL)).then(
      () => 'resolved',
      (err) => err,
    );

    const req = httpMock.expectOne(WS_URL);
    req.flush(
      { detail: 'Invalid or missing X-API-Key header' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const result = await inflight;
    expect(result).not.toBe('resolved');
    expect(apiKey.handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(notification.show).toHaveBeenCalledTimes(1);
    expect(notification.show).toHaveBeenCalledWith(
      NotificationType.ERROR,
      expect.stringContaining('estaciones meteorológicas'),
      expect.objectContaining({ autoClose: true }),
    );
    httpMock.verify();
  });

  it('does not re-prompt on non-401 errors', async () => {
    const { http, httpMock, apiKey, notification } = configure();

    const inflight = firstValueFrom(http.get(WS_URL)).then(
      () => 'resolved',
      (err) => err,
    );

    const req = httpMock.expectOne(WS_URL);
    req.flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });

    const result = await inflight;
    expect(result).not.toBe('resolved');
    expect(apiKey.handleUnauthorized).not.toHaveBeenCalled();
    expect(notification.show).not.toHaveBeenCalled();
    httpMock.verify();
  });
});
