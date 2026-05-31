import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LayerRefreshService } from './layer-refresh.service';
import { LayerConfigService } from './layer-config.service';
import { LayerControlService } from './layer-control.service';
import { LayersService } from './layers.service';
import { NotificationService } from '../notifications/notification.service';
import { environment } from '../../../environments/environment';
import {
  buildWeatherStationsLatestUrl,
  buildWeatherStationsRegistryUrl,
  buildWeatherStationsTilesetUrl,
  buildWeatherStationsTilesetsUrl,
} from '../../config/backend.config';
import { WeatherStationsTemporalMode } from '../../config/layers/weather-stations/controls.constants';
import { LayerCategory, type Layer } from '../../models';

const WEATHER_STATIONS_LAYER_ID = 'weather-stations';

// ----------------------------------------------------------------- test doubles

function buildLayerControlStub(
  overrides: Partial<{
    temporalMode: WeatherStationsTemporalMode;
    maxPastHours: number;
    selectedTilesetId: string | null;
    imageCount: number;
  }> = {},
) {
  const state = {
    temporalMode: overrides.temporalMode ?? WeatherStationsTemporalMode.LATEST,
    maxPastHours: overrides.maxPastHours ?? 6,
    selectedTilesetId: overrides.selectedTilesetId ?? null,
    imageCount: overrides.imageCount ?? 6,
  };
  return {
    activeLayers: signal<readonly { layer: unknown }[]>([]),
    getWeatherStationsTemporalMode: () => state.temporalMode,
    getWeatherStationsMaxPastHours: () => state.maxPastHours,
    getWeatherStationsSelectedTilesetId: () => state.selectedTilesetId,
    getWeatherStationsImageCount: () => state.imageCount,
    setWeatherStationsSelectedTilesetId: (id: string | null) => {
      state.selectedTilesetId = id;
    },
  };
}

const REGISTRY_RESPONSE = {
  fetched_at: '2026-05-17T14:00:00Z',
  source_url: 'http://reg.test',
  stations: [
    {
      station_id: 87344,
      name: 'CORDOBA AERO',
      province: 'CORDOBA',
      latitude: -31.32,
      longitude: -64.2,
      altitude_meters: 495,
      oaci_code: 'SACO',
    },
    {
      station_id: 87582,
      name: 'AEROPARQUE AERO',
      province: 'CAPITAL FEDERAL',
      latitude: -34.55,
      longitude: -58.42,
      altitude_meters: 6,
      oaci_code: 'SABE',
    },
  ],
};

function makeSnapshot(
  scrapedAt: string,
  observations: Array<{ station_id: number; observed_at: string }>,
) {
  return {
    scraped_at: scrapedAt,
    source_url: 'https://api.test/v1/weather/station',
    stations: observations.map((o) => ({
      station_id: o.station_id,
      observed_at: o.observed_at,
      temperature: 18.4,
      feels_like: 17.9,
      humidity: 62,
      pressure: 1013,
      visibility: 10,
      weather: { id: 1, description: 'Despejado' },
      wind: { direction: 'Norte', deg: 5, speed: 8.2 },
    })),
  };
}

interface Harness {
  service: LayerRefreshService;
  httpMock: HttpTestingController;
  controlStub: ReturnType<typeof buildLayerControlStub>;
}

function setupHarness(
  overrides: Partial<{
    temporalMode: WeatherStationsTemporalMode;
    maxPastHours: number;
    selectedTilesetId: string | null;
    imageCount: number;
    apiKey: string;
  }> = {},
): Harness {
  TestBed.resetTestingModule();
  environment.weatherStations.apiKey = overrides.apiKey ?? 'test-api-key';
  const controlStub = buildLayerControlStub(overrides);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LayerControlService, useValue: controlStub },
      {
        provide: LayerConfigService,
        useValue: {
          configs: signal(new Map()),
          hasConfig: () => true,
          fetchLayerConfig: () => ({ subscribe: () => undefined }),
          getConfig: () => undefined,
          calculateTimeIndexForRange: () => undefined,
        },
      },
      {
        provide: LayersService,
        useValue: {
          getLayerById: (id: string) =>
            id === WEATHER_STATIONS_LAYER_ID
              ? ({ id, category: LayerCategory.WEATHER_STATIONS } as unknown as Layer)
              : undefined,
          getLayerDisplayName: () => 'EMA',
        },
      },
      { provide: NotificationService, useValue: { show: () => undefined } },
    ],
  });
  return {
    service: TestBed.inject(LayerRefreshService),
    httpMock: TestBed.inject(HttpTestingController),
    controlStub,
  };
}

// --------------------------------------------------------------------- specs

describe('LayerRefreshService — weather station backend integration', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = setupHarness();
  });

  afterEach(() => {
    harness.httpMock.verify();
  });

  it('LATEST mode: hits /latest and marks every observation hasData=true', async () => {
    const { service, httpMock } = harness;
    const promise = service.loadWeatherStationsSnapshot(true);

    // X-API-Key header injection is owned by `weatherStationsHttpInterceptor`
    // and covered in its own spec; these tests don't wire it in.
    const tilesetsReq = httpMock.expectOne(buildWeatherStationsTilesetsUrl());
    tilesetsReq.flush({
      tilesets: [
        { tileset_id: '20260517T1400Z', scraped_at: '2026-05-17T14:00:00Z', station_count: 2 },
      ],
    });

    const registryReq = httpMock.expectOne(buildWeatherStationsRegistryUrl());
    registryReq.flush(REGISTRY_RESPONSE);

    // Yield so Promise.all([tilesets, registry]) resolves and /latest fires.
    await new Promise((r) => setTimeout(r, 0));

    const latestReq = httpMock.expectOne(buildWeatherStationsLatestUrl());
    expect(latestReq.request.method).toBe('GET');
    latestReq.flush(
      makeSnapshot('2026-05-17T14:05:00Z', [
        { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
        { station_id: 87582, observed_at: '2026-04-01T00:00:00Z' }, // ancient; still hasData=true in LATEST
      ]),
    );

    const snap = await promise;
    expect(snap.source).toBe('latest');
    expect(snap.observations).toHaveLength(2);
    expect(snap.observations.every((o) => o.hasData)).toBe(true);
  });

  it('SPECIFIC mode: hits the tileset URL with N=hours and computes hasData from observed_at', async () => {
    const { service, httpMock } = setupHarness({
      temporalMode: WeatherStationsTemporalMode.SPECIFIC,
      maxPastHours: 3,
      selectedTilesetId: '20260517T1400Z',
    });
    harness = { ...harness, httpMock };

    const promise = service.loadWeatherStationsSnapshot(true);

    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({
      tilesets: [
        { tileset_id: '20260517T1400Z', scraped_at: '2026-05-17T14:00:00Z', station_count: 2 },
      ],
    });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise((r) => setTimeout(r, 0));

    // Target T = 2026-05-17T14:00Z, window = [11:00, 14:00].
    const tilesetReq = httpMock.expectOne(buildWeatherStationsTilesetUrl('20260517T1400Z', 3));
    tilesetReq.flush(
      makeSnapshot('2026-05-17T13:30:00Z', [
        { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' }, // within window
        { station_id: 87582, observed_at: '2026-05-17T08:00:00Z' }, // outside window
      ]),
    );

    const snap = await promise;
    expect(snap.source).toBe('tileset');
    expect(snap.observations).toHaveLength(2);

    const byId = Object.fromEntries(snap.observations.map((o) => [o.station.id, o]));
    expect(byId[87344].hasData).toBe(true);
    expect(byId[87582].hasData).toBe(false);
  });

  it('SPECIFIC mode: warms the rest of the window into the browser cache', async () => {
    // Replay-from-cache itself is the browser HTTP cache (Cache-Control), which
    // HttpTestingController does not simulate — that is verified manually/E2E.
    // Here we assert the warmer issues a GET for the other window frame.
    const { service, httpMock } = setupHarness({
      temporalMode: WeatherStationsTemporalMode.SPECIFIC,
      maxPastHours: 3,
      selectedTilesetId: '20260517T1400Z',
      imageCount: 2,
    });
    harness = { ...harness, httpMock };

    const first = service.loadWeatherStationsSnapshot(true);
    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({
      tilesets: [
        { tileset_id: '20260517T1300Z', scraped_at: '2026-05-17T13:00:00Z', station_count: 1 },
        { tileset_id: '20260517T1400Z', scraped_at: '2026-05-17T14:00:00Z', station_count: 1 },
      ],
    });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise((r) => setTimeout(r, 0));

    // The selected frame is fetched directly (plain GET; the browser caches it).
    httpMock
      .expectOne(buildWeatherStationsTilesetUrl('20260517T1400Z', 3))
      .flush(
        makeSnapshot('2026-05-17T13:55:00Z', [
          { station_id: 87344, observed_at: '2026-05-17T13:50:00Z' },
        ]),
      );
    await first;

    // The other window frame (13:00Z) is warmed; the selected frame is NOT
    // re-requested (the read path already fetched it).
    httpMock.expectOne(buildWeatherStationsTilesetUrl('20260517T1300Z', 3)).flush('{}');
    httpMock.expectNone(buildWeatherStationsTilesetUrl('20260517T1400Z', 3));
  });

  it('caches the registry across multiple snapshot loads (only one GET)', async () => {
    const { service, httpMock } = harness;
    const first = service.loadWeatherStationsSnapshot(true);
    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({ tilesets: [] });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise((r) => setTimeout(r, 0));
    httpMock
      .expectOne(buildWeatherStationsLatestUrl())
      .flush(
        makeSnapshot('2026-05-17T14:00:00Z', [
          { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
        ]),
      );
    await first;

    const second = service.loadWeatherStationsSnapshot(true);
    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({ tilesets: [] });
    httpMock.expectNone(buildWeatherStationsRegistryUrl());
    await new Promise((r) => setTimeout(r, 0));
    httpMock
      .expectOne(buildWeatherStationsLatestUrl())
      .flush(
        makeSnapshot('2026-05-17T14:05:00Z', [
          { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
        ]),
      );
    await second;
  });

  it('manualRefresh on the weather-stations layer refreshes periods instead of the tile config', async () => {
    const { service, httpMock } = harness; // LATEST default; getLayerById returns the weather-stations layer
    let errored: unknown = null;
    let done = false;
    service.manualRefresh(WEATHER_STATIONS_LAYER_ID).subscribe({
      next: () => {
        done = true;
      },
      error: (e) => {
        errored = e;
      },
    });

    // Refreshes the weather-stations periods + snapshot — never calls fetchLayerConfig (which
    // throws "does not require tileset configuration" for this category).
    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({
      tilesets: [
        { tileset_id: '20260517T1400Z', scraped_at: '2026-05-17T14:00:00Z', station_count: 1 },
      ],
    });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise((r) => setTimeout(r, 0));
    httpMock
      .expectOne(buildWeatherStationsLatestUrl())
      .flush(
        makeSnapshot('2026-05-17T14:00:00Z', [
          { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
        ]),
      );
    await new Promise((r) => setTimeout(r, 0));

    expect(errored).toBeNull();
    expect(done).toBe(true);
  });

  it('returns an empty snapshot when the backend errors out', async () => {
    const { service, httpMock } = harness;
    const promise = service.loadWeatherStationsSnapshot(true);

    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({ tilesets: [] });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise((r) => setTimeout(r, 0));
    httpMock.expectOne(buildWeatherStationsLatestUrl()).flush('upstream down', {
      status: 503,
      statusText: 'Service Unavailable',
    });

    const snap = await promise;
    expect(snap.observations).toEqual([]);
    expect(snap.source).toBe('latest');
  });
});
