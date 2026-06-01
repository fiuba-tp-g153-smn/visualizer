import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WeatherStationsHistoryService } from './weather-stations-history.service';
import { buildWeatherStationsSeriesUrl } from '../../config/backend.config';
import type { BackendStationSeries } from '../../models/geo/weather-station-series.model';

const BACKEND: BackendStationSeries = {
  station_id: 87344,
  station_name: 'CORDOBA AERO',
  province: 'CORDOBA',
  hours: 48,
  points: [
    {
      observed_at: '2026-05-17T13:00:00Z',
      temperature: 17.0,
      feels_like: 16.5,
      humidity: 60,
      pressure: 1013,
      visibility: 10,
      dew_point: 9.3,
      wind_speed: 5,
      wind_deg: 350,
      wind_direction: 'Norte',
    },
    {
      observed_at: '2026-05-17T14:00:00Z',
      temperature: 18.4,
      feels_like: 17.9,
      humidity: 62,
      pressure: 1013.2,
      visibility: 10,
      dew_point: 11.0,
      wind_speed: 8.2,
      wind_deg: 5,
      wind_direction: 'Norte',
    },
  ],
  latest: {
    observed_at: '2026-05-17T14:00:00Z',
    temperature: 18.4,
    feels_like: 17.9,
    humidity: 62,
    pressure: 1013.2,
    visibility: 10,
    dew_point: 11.0,
    wind_speed: 8.2,
    wind_deg: 5,
    wind_direction: 'Norte',
  },
};

describe('WeatherStationsHistoryService', () => {
  let service: WeatherStationsHistoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherStationsHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('issues one GET to the series URL and maps the payload', async () => {
    const promise = service.fetchSeries(87344, 48);
    httpMock.expectOne(buildWeatherStationsSeriesUrl(87344, 48)).flush(BACKEND);

    const series = await promise;
    expect(series.stationId).toBe(87344);
    expect(series.stationName).toBe('CORDOBA AERO');
    expect(series.points).toHaveLength(2);
    // observed_at -> epoch ms for the datetime axis, oldest first.
    expect(series.points[0].t).toBe(Date.parse('2026-05-17T13:00:00Z'));
    expect(series.points[1].windSpeed).toBe(8.2);
    expect(series.latest?.temperature).toBe(18.4);
  });

  it('collapses concurrent fetches of the same station into a single request', async () => {
    const a = service.fetchSeries(87344);
    const b = service.fetchSeries(87344);
    httpMock.expectOne(buildWeatherStationsSeriesUrl(87344, 48)).flush(BACKEND);

    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb); // same resolved payload, one request
  });

  it('drops points with an unparseable timestamp', async () => {
    const promise = service.fetchSeries(1);
    httpMock.expectOne(buildWeatherStationsSeriesUrl(1, 48)).flush({
      ...BACKEND,
      station_id: 1,
      points: [{ ...BACKEND.points[0], observed_at: 'not-a-date' }, BACKEND.points[1]],
      latest: null,
    });

    const series = await promise;
    expect(series.points).toHaveLength(1);
    expect(series.points[0].observedAt).toBe('2026-05-17T14:00:00Z');
    // latest falls back to the newest valid point when the payload omits it.
    expect(series.latest?.observedAt).toBe('2026-05-17T14:00:00Z');
  });
});
