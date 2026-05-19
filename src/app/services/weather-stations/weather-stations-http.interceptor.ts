import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { NotificationType } from '../../models';
import { NotificationService } from '../notifications/notification.service';
import { WeatherStationsApiKeyService } from './weather-stations-api-key.service';

const WEATHER_STATIONS_PATH_FRAGMENT = '/weather-stations/';

function isWeatherStationsRequest(url: string): boolean {
  return url.includes(WEATHER_STATIONS_PATH_FRAGMENT);
}

function applyApiKey<T>(req: HttpRequest<T>, key: string | null): HttpRequest<T> {
  return key ? req.clone({ setHeaders: { 'X-API-Key': key } }) : req;
}

/**
 * Owns the `X-API-Key` header and 401 recovery for every /weather-stations/*
 * request. Replaces the per-callsite header injection and the per-method 401
 * retry loop that used to live in `LayerRefreshService`.
 *
 * On 401, calls `WeatherStationsApiKeyService.handleUnauthorized()` which
 * collapses concurrent prompts (so three parallel 401s share one dialog).
 * If the user provides a new key, the request retries once with the new
 * header. If the user cancels, a persistent error notification is shown and
 * the 401 propagates so callers can fail-soft.
 */
export const weatherStationsHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isWeatherStationsRequest(req.url)) {
    return next(req);
  }
  const apiKeyService = inject(WeatherStationsApiKeyService);
  const notifications = inject(NotificationService);

  return next(applyApiKey(req, apiKeyService.getKey())).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return from(apiKeyService.handleUnauthorized()).pipe(
        switchMap((newKey) => {
          if (!newKey) {
            // Transient toast (auto-dismisses) rather than the persistent
            // `error()` banner — the user has already seen + cancelled the
            // re-prompt, so a lingering banner adds no information.
            notifications.show(
              NotificationType.ERROR,
              'No se pudieron cargar las estaciones meteorológicas: tu clave no es válida.',
              { autoClose: true, duration: 5000 },
            );
            return throwError(() => err);
          }
          return next(applyApiKey(req, newKey));
        }),
      );
    }),
  );
};
