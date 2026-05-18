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
import { SmnStationsTemporalMode } from '../../config/layers/smn-stations/controls.constants';

// ----------------------------------------------------------------- test doubles

function buildLayerControlStub(
  overrides: Partial<{
    temporalMode: SmnStationsTemporalMode;
    maxPastHours: number;
    selectedTilesetId: string | null;
  }> = {},
) {
  const state = {
    temporalMode: overrides.temporalMode ?? SmnStationsTemporalMode.LATEST,
    maxPastHours: overrides.maxPastHours ?? 6,
    selectedTilesetId: overrides.selectedTilesetId ?? null,
  };
  return {
    activeLayers: signal<readonly { layer: unknown }[]>([]),
    getSmnStationsTemporalMode: () => state.temporalMode,
    getSmnStationsMaxPastHours: () => state.maxPastHours,
    getSmnStationsSelectedTilesetId: () => state.selectedTilesetId,
    setSmnStationsSelectedTilesetId: (id: string | null) => {
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
    temporalMode: SmnStationsTemporalMode;
    maxPastHours: number;
    selectedTilesetId: string | null;
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
        useValue: { getLayerById: () => undefined, getLayerDisplayName: () => '' },
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

describe('LayerRefreshService — SMN backend integration', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = setupHarness();
  });

  afterEach(() => {
    harness.httpMock.verify();
  });

  it('LATEST mode: hits /latest with X-API-Key header and marks every observation hasData=true', async () => {
    const { service, httpMock } = harness;
    const promise = service.loadSmnStationsSnapshot(true);

    const tilesetsReq = httpMock.expectOne(buildWeatherStationsTilesetsUrl());
    expect(tilesetsReq.request.headers.get('X-API-Key')).toBe('test-api-key');
    tilesetsReq.flush({
      tilesets: [
        { tileset_id: '20260517T1400Z', scraped_at: '2026-05-17T14:00:00Z', station_count: 2 },
      ],
    });

    const registryReq = httpMock.expectOne(buildWeatherStationsRegistryUrl());
    expect(registryReq.request.headers.get('X-API-Key')).toBe('test-api-key');
    registryReq.flush(REGISTRY_RESPONSE);

    // Yield so Promise.all([tilesets, registry]) resolves and /latest fires.
    await new Promise(r => setTimeout(r, 0));

    const latestReq = httpMock.expectOne(buildWeatherStationsLatestUrl());
    expect(latestReq.request.method).toBe('GET');
    expect(latestReq.request.headers.get('X-API-Key')).toBe('test-api-key');
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
      temporalMode: SmnStationsTemporalMode.SPECIFIC,
      maxPastHours: 3,
      selectedTilesetId: '20260517T1400Z',
    });
    harness = { ...harness, httpMock };

    const promise = service.loadSmnStationsSnapshot(true);

    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({
      tilesets: [
        { tileset_id: '20260517T1400Z', scraped_at: '2026-05-17T14:00:00Z', station_count: 2 },
      ],
    });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise(r => setTimeout(r, 0));

    // Target T = 2026-05-17T14:00Z, window = [11:00, 14:00].
    const tilesetReq = httpMock.expectOne(buildWeatherStationsTilesetUrl('20260517T1400Z', 3));
    expect(tilesetReq.request.headers.get('X-API-Key')).toBe('test-api-key');
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

  it('caches the registry across multiple snapshot loads (only one GET)', async () => {
    const { service, httpMock } = harness;
    const first = service.loadSmnStationsSnapshot(true);
    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({ tilesets: [] });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise(r => setTimeout(r, 0));
    httpMock
      .expectOne(buildWeatherStationsLatestUrl())
      .flush(makeSnapshot('2026-05-17T14:00:00Z', [
        { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
      ]));
    await first;

    const second = service.loadSmnStationsSnapshot(true);
    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({ tilesets: [] });
    httpMock.expectNone(buildWeatherStationsRegistryUrl());
    await new Promise(r => setTimeout(r, 0));
    httpMock
      .expectOne(buildWeatherStationsLatestUrl())
      .flush(makeSnapshot('2026-05-17T14:05:00Z', [
        { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
      ]));
    await second;
  });

  it('omits X-API-Key when the env var is empty', async () => {
    const { service, httpMock } = setupHarness({ apiKey: '' });
    harness = { ...harness, httpMock };

    const promise = service.loadSmnStationsSnapshot(true);

    const tilesetsReq = httpMock.expectOne(buildWeatherStationsTilesetsUrl());
    expect(tilesetsReq.request.headers.has('X-API-Key')).toBe(false);
    tilesetsReq.flush({ tilesets: [] });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise(r => setTimeout(r, 0));
    httpMock
      .expectOne(buildWeatherStationsLatestUrl())
      .flush(makeSnapshot('2026-05-17T14:00:00Z', [
        { station_id: 87344, observed_at: '2026-05-17T13:00:00Z' },
      ]));
    await promise;
  });

  it('returns an empty snapshot when the backend errors out', async () => {
    const { service, httpMock } = harness;
    const promise = service.loadSmnStationsSnapshot(true);

    httpMock.expectOne(buildWeatherStationsTilesetsUrl()).flush({ tilesets: [] });
    httpMock.expectOne(buildWeatherStationsRegistryUrl()).flush(REGISTRY_RESPONSE);
    await new Promise(r => setTimeout(r, 0));
    httpMock.expectOne(buildWeatherStationsLatestUrl()).flush('upstream down', {
      status: 503,
      statusText: 'Service Unavailable',
    });

    const snap = await promise;
    expect(snap.observations).toEqual([]);
    expect(snap.source).toBe('latest');
  });
});
