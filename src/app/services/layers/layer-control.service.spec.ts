import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { STORAGE_KEYS } from '../../constants';
import {
  EcmwfTpTileLayerConfig,
  LayerCategory,
  LayerConfig,
  LayerType,
  TilesetEntry,
} from '../../models';

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
      maxPastHours: 24,
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
      configMap.set(layerId, newConfig);
      publish();
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

  it('rebuilds availableTilesets when the layer is reactivated after every forecast was toggled off', () => {
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

    // Steps 2–3: toggle the only selected forecast off — the layer deactivates
    // and availableTilesets is driven to empty (this is the "broken" state the
    // user reproduces by deactivating the run).
    service.toggleEcmwfTpForecast(ECMWF_LAYER_ID, FORECAST_LATEST);
    expect(configStub.getAvailableTilesets(ECMWF_LAYER_ID)).toEqual([]);

    // Step 4: reactivate. Without the fix, availableTilesets would stay [] and
    // the period selector would render "No hay períodos disponibles" forever.
    service.activateLayer(ECMWF_LAYER_ID);
    const tilesetsAfterReactivation = configStub.getAvailableTilesets(ECMWF_LAYER_ID);
    expect(tilesetsAfterReactivation?.length).toBeGreaterThan(0);
    // The seeded forecast is the most recent one, so its periods must surface.
    expect(tilesetsAfterReactivation?.map((t) => t.id)).toEqual(['P1', 'P2', 'P3']);
  });
});
