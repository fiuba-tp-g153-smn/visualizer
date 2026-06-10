import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { STORAGE_KEYS } from '../../constants';
import {
  EcmwfTpLayerControls,
  EcmwfTpTileLayerConfig,
  LayerCategory,
  LayerConfig,
  LayerType,
  TilesetEntry,
  WrfLayerControls,
} from '../../models';

// Mirrors LayerConfigService.configsAreEqual's availableTilesets comparison —
// without it, stub updates always publish a new Map reference and the
// reconciliation effect (which re-derives availableTilesets on every configs()
// emission) spins forever reacting to its own writes.
function tilesetIdsAreEqual(a: readonly TilesetEntry[], b: readonly TilesetEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => entry.id === b[i].id);
}

describe('LayerControlService — weather stations no-data toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [] });
  });

  it('defaults showStationsWithoutData to true on a fresh load', () => {
    const service = TestBed.inject(LayerControlService);
    expect(service.getWeatherStationsShowStationsWithoutData()).toBe(true);
    expect(service.weatherStationsShowStationsWithoutData()).toBe(true);
  });

  it('persists the toggle through localStorage so the next session reads it back', () => {
    const service = TestBed.inject(LayerControlService);
    service.setWeatherStationsShowStationsWithoutData(false);

    expect(service.getWeatherStationsShowStationsWithoutData()).toBe(false);

    // Simulate a page reload: drop the TestBed, instantiate again, and confirm
    // the persisted state survives.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [] });
    const reloaded = TestBed.inject(LayerControlService);
    expect(reloaded.getWeatherStationsShowStationsWithoutData()).toBe(false);
  });

  it('keeps the default when localStorage holds a payload missing the field', () => {
    // Older clients persisted the shared-controls blob without
    // `showStationsWithoutData`; loading it must still resolve to the default.
    const legacyBlob = JSON.stringify({
      opacity: 1,
      zIndex: null,
      scaleVisible: false,
      temporalMode: 'latest',
      gracePeriodHours: 24,
      imageCount: 6,
      selectedTilesetId: null,
    });
    localStorage.setItem(STORAGE_KEYS.WEATHER_STATIONS_SHARED_CONTROLS, legacyBlob);

    const service = TestBed.inject(LayerControlService);
    expect(service.getWeatherStationsShowStationsWithoutData()).toBe(true);
  });

  it('exposes a computed signal that updates when the setter is called', () => {
    const service = TestBed.inject(LayerControlService);
    const initial = service.weatherStationsShowStationsWithoutData();
    expect(initial).toBe(true);

    service.setWeatherStationsShowStationsWithoutData(false);
    expect(service.weatherStationsShowStationsWithoutData()).toBe(false);

    service.setWeatherStationsShowStationsWithoutData(true);
    expect(service.weatherStationsShowStationsWithoutData()).toBe(true);
  });
});

describe('LayerControlService — ECMWF reactivation after full deactivation', () => {
  const ECMWF_LAYER_ID = 'ecmwf/total-precipitation';
  const FORECAST_LATEST = '20260520T0000Z';
  const FORECAST_PREVIOUS = '20260519T1200Z';

  // Minimal LayerConfigService stub that mirrors the real
  // updateEcmwfTpSelectedForecasts behavior (period union → availableTilesets)
  // so the test exercises the same control flow without HTTP.
  function buildConfigServiceStub() {
    const configMap = new Map<string, LayerConfig>();
    const configsSignal = signal<Map<string, LayerConfig>>(configMap);

    const publish = () => configsSignal.set(new Map(configMap));

    const seedConfig = (id: string, config: EcmwfTpTileLayerConfig) => {
      configMap.set(id, config);
      publish();
    };

    const updateEcmwfTpSelectedForecasts = (
      layerId: string,
      selected: string[],
    ): EcmwfTpTileLayerConfig | undefined => {
      const config = configMap.get(layerId) as EcmwfTpTileLayerConfig | undefined;
      if (!config || config.category !== LayerCategory.ECMWF_TP) return undefined;

      const periodSet = new Set<string>();
      for (const ts of selected) {
        for (const p of config.periodsByForecast[ts] ?? []) periodSet.add(p);
      }
      const availableTilesets: TilesetEntry[] = [...periodSet]
        .sort()
        .map((id) => ({ id, time: new Date(0) }));
      const newConfig: EcmwfTpTileLayerConfig = { ...config, availableTilesets };
      if (!tilesetIdsAreEqual(config.availableTilesets, availableTilesets)) {
        configMap.set(layerId, newConfig);
        publish();
      }
      return newConfig;
    };

    return {
      configs: configsSignal,
      getConfig: (id: string) => configMap.get(id),
      hasConfig: (id: string) => configMap.has(id),
      getAvailableTilesets: (id: string) => {
        const c = configMap.get(id);
        return c?.type === LayerType.TILE ? c.availableTilesets : undefined;
      },
      calculateTimeIndexForRange: () => 0,
      updateEcmwfTpSelectedForecasts,
      seedConfig,
    };
  }

  function buildEcmwfConfig(): EcmwfTpTileLayerConfig {
    // Two runs with overlapping periods. Initial availableTilesets matches
    // FORECAST_LATEST's periods, simulating the post-fetch state.
    return {
      layerId: ECMWF_LAYER_ID,
      type: LayerType.TILE,
      category: LayerCategory.ECMWF_TP,
      availableForecasts: [FORECAST_LATEST, FORECAST_PREVIOUS],
      periodsByForecast: {
        [FORECAST_LATEST]: ['P1', 'P2', 'P3'],
        [FORECAST_PREVIOUS]: ['P0', 'P1', 'P2'],
      },
      forecastsByPeriod: {
        P0: [FORECAST_PREVIOUS],
        P1: [FORECAST_LATEST, FORECAST_PREVIOUS],
        P2: [FORECAST_LATEST, FORECAST_PREVIOUS],
        P3: [FORECAST_LATEST],
      },
      availableTilesets: [
        { id: 'P1', time: new Date(0) },
        { id: 'P2', time: new Date(0) },
        { id: 'P3', time: new Date(0) },
      ],
    };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('rebuilds availableTilesets after every forecast is toggled off and one is reselected', () => {
    const configStub = buildConfigServiceStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LayerConfigService, useValue: configStub }],
    });
    configStub.seedConfig(ECMWF_LAYER_ID, buildEcmwfConfig());

    const service = TestBed.inject(LayerControlService);

    // Step 1: activate the layer. activateLayer seeds the most recent forecast.
    service.activateLayer(ECMWF_LAYER_ID);
    expect(configStub.getAvailableTilesets(ECMWF_LAYER_ID)?.length).toBeGreaterThan(0);

    // Steps 2-3: toggling the only run off empties the selection and
    // availableTilesets, but the layer stays active (just stops the
    // animation) so the user can pick a different run without reactivating.
    service.toggleEcmwfTpForecast(ECMWF_LAYER_ID, FORECAST_LATEST);
    expect(configStub.getAvailableTilesets(ECMWF_LAYER_ID)).toEqual([]);
    expect(service.getControls(ECMWF_LAYER_ID).visible).toBe(true);

    // Step 4: reselect a forecast — availableTilesets must rebuild, not stay
    // stale at [].
    service.toggleEcmwfTpForecast(ECMWF_LAYER_ID, FORECAST_LATEST);
    const tilesetsAfterReselection = configStub.getAvailableTilesets(ECMWF_LAYER_ID);
    expect(tilesetsAfterReselection?.length).toBeGreaterThan(0);
    expect(tilesetsAfterReselection?.map((t) => t.id)).toEqual(['P1', 'P2', 'P3']);
  });
});

describe('LayerControlService — forecast secondary render controls', () => {
  const ECMWF_LAYER_ID = 'ecmwf/total-precipitation';
  const WRF_LAYER_ID = 'wrf/Precipitacion1h';
  const ECMWF_FORECAST = '20260520T0000Z';
  const WRF_FORECAST = '20260430_060000';

  function buildConfigServiceStub() {
    const configMap = new Map<string, LayerConfig>();
    const configsSignal = signal<Map<string, LayerConfig>>(configMap);

    const publish = () => configsSignal.set(new Map(configMap));

    return {
      configs: configsSignal,
      getConfig: (id: string) => configMap.get(id),
      hasConfig: (id: string) => configMap.has(id),
      getAvailableTilesets: (id: string) => {
        const c = configMap.get(id);
        return c?.type === LayerType.TILE ? c.availableTilesets : undefined;
      },
      calculateTimeIndexForRange: () => 0,
      updateEcmwfTpSelectedForecasts: (layerId: string, selected: string[]) => {
        const config = configMap.get(layerId) as EcmwfTpTileLayerConfig | undefined;
        if (!config || config.category !== LayerCategory.ECMWF_TP) return undefined;
        const periodSet = new Set<string>();
        for (const ts of selected) {
          for (const p of config.periodsByForecast[ts] ?? []) periodSet.add(p);
        }
        const availableTilesets: TilesetEntry[] = [...periodSet]
          .sort()
          .map((id) => ({ id, time: new Date(0) }));
        const next = { ...config, availableTilesets };
        if (!tilesetIdsAreEqual(config.availableTilesets, availableTilesets)) {
          configMap.set(layerId, next);
          publish();
        }
        return next;
      },
      updateWrfSelectedForecasts: (layerId: string) => {
        const config = configMap.get(layerId);
        return config?.type === LayerType.TILE && config.category === LayerCategory.WRF
          ? config
          : undefined;
      },
      seedConfig: (id: string, config: LayerConfig) => {
        configMap.set(id, config);
        publish();
      },
    };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('stores ECMWF secondary render controls by forecast index and hydrates them back', () => {
    const configStub = buildConfigServiceStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LayerConfigService, useValue: configStub }],
    });

    configStub.seedConfig(ECMWF_LAYER_ID, {
      layerId: ECMWF_LAYER_ID,
      type: LayerType.TILE,
      category: LayerCategory.ECMWF_TP,
      availableForecasts: [ECMWF_FORECAST],
      periodsByForecast: { [ECMWF_FORECAST]: ['P1'] },
      forecastsByPeriod: { P1: [ECMWF_FORECAST] },
      availableTilesets: [{ id: 'P1', time: new Date(0) }],
    } satisfies EcmwfTpTileLayerConfig);

    const service = TestBed.inject(LayerControlService);
    service.activateLayer(ECMWF_LAYER_ID);
    service.setEcmwfTpForecastRenderVisible(
      ECMWF_LAYER_ID,
      ECMWF_FORECAST,
      'ecmwf-mslp-isobars',
      false,
    );
    service.setEcmwfTpForecastRenderOpacity(
      ECMWF_LAYER_ID,
      ECMWF_FORECAST,
      'ecmwf-mslp-isobars',
      0.35,
    );
    TestBed.flushEffects();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LayerConfigService, useValue: configStub }],
    });

    const reloaded = TestBed.inject(LayerControlService);
    TestBed.flushEffects();
    const controls = reloaded.getControls(ECMWF_LAYER_ID) as EcmwfTpLayerControls;

    expect(controls.forecast.renderControls[ECMWF_FORECAST]).toEqual({
      // PRIMARY_RENDER_ID stays selected by default — only the isobars overlay
      // (the only one explicitly hidden) drops out of the selection.
      selectedRenderIds: ['primary'],
      renderOpacity: { 'ecmwf-mslp-isobars': 0.35 },
    });
  });

  it('excludes a forecast from the timeline when all of its renders are disabled, and restores it when re-enabled', () => {
    const configStub = buildConfigServiceStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LayerConfigService, useValue: configStub }],
    });

    configStub.seedConfig(ECMWF_LAYER_ID, {
      layerId: ECMWF_LAYER_ID,
      type: LayerType.TILE,
      category: LayerCategory.ECMWF_TP,
      availableForecasts: [ECMWF_FORECAST],
      periodsByForecast: { [ECMWF_FORECAST]: ['P1'] },
      forecastsByPeriod: { P1: [ECMWF_FORECAST] },
      availableTilesets: [{ id: 'P1', time: new Date(0) }],
    } satisfies EcmwfTpTileLayerConfig);

    const service = TestBed.inject(LayerControlService);
    service.activateLayer(ECMWF_LAYER_ID);
    expect(configStub.getAvailableTilesets(ECMWF_LAYER_ID)?.length).toBeGreaterThan(0);

    // Disable every render (primary + secondary) for the only selected run —
    // it should drop out of the timeline without deactivating the layer.
    service.setEcmwfTpForecastRenderVisible(ECMWF_LAYER_ID, ECMWF_FORECAST, 'primary', false);
    service.setEcmwfTpForecastRenderVisible(
      ECMWF_LAYER_ID,
      ECMWF_FORECAST,
      'ecmwf-mslp-isobars',
      false,
    );

    expect(configStub.getAvailableTilesets(ECMWF_LAYER_ID)).toEqual([]);
    expect(service.getControls(ECMWF_LAYER_ID).visible).toBe(true);

    // Re-enabling a render brings the run back into the timeline.
    service.setEcmwfTpForecastRenderVisible(ECMWF_LAYER_ID, ECMWF_FORECAST, 'primary', true);
    const tilesets = configStub.getAvailableTilesets(ECMWF_LAYER_ID);
    expect(tilesets?.map((t) => t.id)).toEqual(['P1']);
  });

  it('initializes WRF forecast secondary render controls and persists raw forecast keys', () => {
    const configStub = buildConfigServiceStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LayerConfigService, useValue: configStub }],
    });

    configStub.seedConfig(WRF_LAYER_ID, {
      layerId: WRF_LAYER_ID,
      type: LayerType.TILE,
      category: LayerCategory.WRF,
      availableForecasts: [WRF_FORECAST],
      periodsByForecast: { [WRF_FORECAST]: ['F001'] },
      forecastsByPeriod: { STEP_1: [WRF_FORECAST] },
      availableTilesets: [{ id: 'STEP_1', time: new Date(0) }],
      layersByStep: { [`${WRF_FORECAST}/F001`]: ['barbs', 'slp'] },
    });

    const service = TestBed.inject(LayerControlService);
    service.activateLayer(WRF_LAYER_ID);
    service.setWrfForecastRenderVisible(
      WRF_LAYER_ID,
      WRF_FORECAST,
      'wrf-Precipitacion1h-barbs',
      false,
    );
    service.setWrfForecastRenderOpacity(WRF_LAYER_ID, WRF_FORECAST, 'wrf-Precipitacion1h-slp', 0.6);

    const controls = service.getControls(WRF_LAYER_ID) as WrfLayerControls;
    expect(controls.forecast.renderControls[WRF_FORECAST]).toEqual({
      // PRIMARY_RENDER_ID stays selected by default — only the barbs render
      // (the only one explicitly hidden) drops out of the selection.
      selectedRenderIds: ['primary', 'wrf-Precipitacion1h-slp'],
      renderOpacity: { 'wrf-Precipitacion1h-slp': 0.6 },
    });
  });
});
