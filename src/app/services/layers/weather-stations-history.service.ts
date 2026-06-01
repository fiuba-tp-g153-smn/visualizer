import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { buildWeatherStationsSeriesUrl } from '../../config/backend.config';
import {
  adaptStationSeries,
  type BackendStationSeries,
  type StationSeries,
} from '../../models/geo/weather-station-series.model';

/**
 * Fetches a single station's bundled 48 h history — the **one** request the
 * history feature makes. Both the popover sparklines and the full-page charts
 * reuse the returned payload (the dialog gets it via `MAT_DIALOG_DATA`), so
 * opening the full page issues no new request.
 *
 * Repeat fetches of the same station hit the **browser HTTP cache** (off-heap,
 * gated by the endpoint's `Cache-Control`), like the tile layers. The only
 * retained state is a small in-flight map that collapses concurrent duplicate
 * fetches into one request; the `X-API-Key` header is added by the interceptor.
 */
@Injectable({
  providedIn: 'root',
})
export class WeatherStationsHistoryService {
  private readonly http = inject(HttpClient);
  private readonly inFlight = new Map<string, Promise<StationSeries>>();

  fetchSeries(stationId: number, hours = 48): Promise<StationSeries> {
    const url = buildWeatherStationsSeriesUrl(stationId, hours);
    const existing = this.inFlight.get(url);
    if (existing) {
      return existing;
    }
    const promise = firstValueFrom(this.http.get<BackendStationSeries>(url))
      .then((raw) => adaptStationSeries(raw))
      .finally(() => {
        this.inFlight.delete(url);
      });
    this.inFlight.set(url, promise);
    return promise;
  }
}
