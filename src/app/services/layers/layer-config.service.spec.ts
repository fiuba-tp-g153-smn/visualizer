import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { buildConfigUrl } from '../../config';
import {
  ActiveLayerGroupId,
  EcmwfTpTileLayer,
  EcmwfTpTileLayerConfig,
  LayerCategory,
  LayerType,
} from '../../models';

// --------------------------------------------------------------------- helpers

/**
 * Builds a synthetic ECMWF TP layer mirroring the production config (47-period
 * per-forecast cap), so the union of two consecutive runs can legitimately
 * exceed the cap.
 */
function buildEcmwfTpLayer(): EcmwfTpTileLayer {
  return {
    id: 'ecmwf/total-precipitation',
    name: 'Precipitación total',
    description: '',
    type: LayerType.TILE,
    category: LayerCategory.ECMWF_TP,
    variable: 'total-precipitation',
    availablePeriods: [1, 6, 12, 24, 47] as const,
    zIndexGroup: ActiveLayerGroupId.BASE,
    minNativeZoom: 3,
    maxNativeZoom: 7,
    isForecast: true,
    boundingBox: [
      [-60, -110],
      [-15, -30],
    ] as const,
  } as unknown as EcmwfTpTileLayer;
}

/**
 * Formats a Date as ECMWF's `YYYYMMDDTHHMMZ` so the IDs round-trip through
 * `parseEcmwfTimestamp` without collapsing to the epoch fallback.
 */
function ecmwfTs(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}00Z`;
}

/**
 * Returns `count` periods spaced 3h apart starting at `start`.
 */
function periodsEvery3h(start: Date, count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 3 * 60 * 60 * 1000);
    result.push(ecmwfTs(d));
  }
  return result;
}

/**
 * Flushes the queue of pending microtasks so deferred config writes from
 * `LayerConfigService.updateConfigMap` (which uses `queueMicrotask`) land
 * before assertions run.
 */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

interface FetchHarness {
  service: LayerConfigService;
  httpMock: HttpTestingController;
  layer: EcmwfTpTileLayer;
  /** Forecast run A (older). */
  forecastA: string;
  /** Forecast run B (newer). */
  forecastB: string;
  periodsA: string[];
  periodsB: string[];
  union: string[];
}

function setup(): FetchHarness {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: LayersService,
        useValue: { getLayerById: () => undefined, getLayerDisplayName: () => '' },
      },
    ],
  });

  const layer = buildEcmwfTpLayer();
  // Two runs 12h apart, 47 periods each at 3h cadence. The 12h offset adds
  // 4 unique periods at the end of run B → union = 47 + 4 = 51, which is
  // strictly greater than maxLoopPeriods (47). That's the configuration where
  // the trim-on-refresh bug used to fire.
  const runA = new Date(Date.UTC(2026, 4, 20, 0, 0, 0));
  const runB = new Date(Date.UTC(2026, 4, 20, 12, 0, 0));
  const periodsA = periodsEvery3h(new Date(runA.getTime() + 3 * 3600 * 1000), 47);
  const periodsB = periodsEvery3h(new Date(runB.getTime() + 3 * 3600 * 1000), 47);
  const union = [...new Set([...periodsA, ...periodsB])].sort();

  return {
    service: TestBed.inject(LayerConfigService),
    httpMock: TestBed.inject(HttpTestingController),
    layer,
    forecastA: ecmwfTs(runA),
    forecastB: ecmwfTs(runB),
    periodsA,
    periodsB,
    union,
  };
}

/**
 * Drives one full fetchEcmwfTpLayerConfig round-trip against the HTTP mock.
 */
async function fetchOnce(h: FetchHarness): Promise<EcmwfTpTileLayerConfig> {
  const promise = firstValueFrom(h.service.fetchEcmwfTpLayerConfig(h.layer));

  h.httpMock.expectOne(buildConfigUrl(h.layer.id)).flush({
    forecasts: [{ forecast_ts: h.forecastA }, { forecast_ts: h.forecastB }],
  });

  // Yield so forkJoin's per-forecast requests are queued before we flush them.
  await Promise.resolve();

  h.httpMock
    .expectOne(buildConfigUrl(`${h.layer.id}/${h.forecastA}`))
    .flush({ periods: h.periodsA.map((period_ts) => ({ period_ts })) });
  h.httpMock
    .expectOne(buildConfigUrl(`${h.layer.id}/${h.forecastB}`))
    .flush({ periods: h.periodsB.map((period_ts) => ({ period_ts })) });

  const config = (await promise) as EcmwfTpTileLayerConfig;
  await flushMicrotasks();
  return config;
}

// --------------------------------------------------------------------- specs

describe('LayerConfigService — ECMWF TP auto-refresh', () => {
  let harness: FetchHarness;

  beforeEach(() => {
    harness = setup();
  });

  afterEach(() => {
    harness.httpMock.verify();
  });

  it('keeps the over-cap selection-aware union untouched on auto-refresh (no tile churn)', async () => {
    // 1. Initial fetch. Seeds availableTilesets from forecasts[0]'s periods
    //    (the actual content here doesn't matter for the regression — what
    //    matters is that there *is* an existing config in the cache before
    //    step 3 runs).
    await fetchOnce(harness);

    // 2. Simulate the LayerControlService reconciliation effect: the user
    //    has both runs selected, so availableTilesets becomes the full
    //    union (51 entries — strictly more than the 47-period per-forecast
    //    cap from layer.availablePeriods).
    const reconciled = harness.service.updateEcmwfTpSelectedForecasts(harness.layer.id, [
      harness.forecastA,
      harness.forecastB,
    ]);
    await flushMicrotasks();
    expect(reconciled).toBeDefined();
    expect(harness.union.length).toBe(51);
    expect(reconciled!.availableTilesets.map((t) => t.id)).toEqual(harness.union);

    const cachedAfterReconcile = harness.service.getConfig(
      harness.layer.id,
    ) as EcmwfTpTileLayerConfig;
    expect(cachedAfterReconcile.availableTilesets).toHaveLength(51);

    // 3. The 10s auto-refresh fires. Backend payload is identical to step 1.
    //    Before the fix, this branch ran `keepLatestTilesetsForLayer` on the
    //    existing 51-entry union, trimming it back to 47 → the configMap
    //    signal emitted → `syncLayers` saw a different period at the current
    //    cursor → Leaflet refetched tiles. The reconciliation effect then
    //    rebuilt the 51-entry union, triggering a second emission and
    //    completing the ping-pong every 10s.
    await fetchOnce(harness);

    // 4. The selection-aware union must survive verbatim across the refresh.
    //    Same length, same IDs, same order — that's what
    //    `LayerConfigService.configsAreEqual` and `arraysAreEqual` rely on
    //    to short-circuit the deferred `configMap` write and stop the loop.
    const cachedAfterRefresh = harness.service.getConfig(
      harness.layer.id,
    ) as EcmwfTpTileLayerConfig;
    expect(cachedAfterRefresh.availableTilesets).toHaveLength(51);
    expect(cachedAfterRefresh.availableTilesets.map((t) => t.id)).toEqual(harness.union);
  });
});
