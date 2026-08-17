import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { LayerAvailabilityService } from './layer-availability.service';
import { LayerConfigService } from './layer-config.service';
import { LayerRefreshService } from './layer-refresh.service';
import { LayersService } from './layers.service';
import { WeatherStationsApiKeyService } from '../weather-stations/weather-stations-api-key.service';
import {
  ActiveLayerGroupId,
  EcmwfTpTileLayerConfig,
  GoesTileLayerConfig,
  Layer,
  LayerCategory,
  LayerConfig,
  LayerType,
  WmsLayer,
} from '../../models';

// --------------------------------------------------------------------- helpers

function goesLayer(id = 'goes/abi/ch-13'): Layer {
  return {
    id,
    name: 'Canal 13',
    type: LayerType.TILE,
    category: LayerCategory.GOES_19,
    zIndexGroup: ActiveLayerGroupId.BASE,
    minNativeZoom: 1,
    maxNativeZoom: 8,
    isForecast: false,
  } as unknown as Layer;
}

function ecmwfLayer(id = 'ecmwf/total-precipitation'): Layer {
  return {
    id,
    name: 'Precipitación total',
    type: LayerType.TILE,
    category: LayerCategory.ECMWF_TP,
    variable: 'total-precipitation',
    zIndexGroup: ActiveLayerGroupId.BASE,
    minNativeZoom: 3,
    maxNativeZoom: 7,
    isForecast: true,
  } as unknown as Layer;
}

function wmsLayer(id = 'ign/limits'): WmsLayer {
  return {
    id,
    name: 'Límites',
    type: LayerType.WMS,
    category: LayerCategory.IGN_WMS,
    zIndexGroup: ActiveLayerGroupId.OVERLAY,
    wmsLayerName: 'limites',
  } as unknown as WmsLayer;
}

function weatherStationsLayer(id = 'weather-stations/temperature'): Layer {
  return {
    id,
    name: 'Temperatura',
    type: LayerType.VECTOR,
    category: LayerCategory.WEATHER_STATIONS,
    zIndexGroup: ActiveLayerGroupId.OVERLAY,
  } as unknown as Layer;
}

function goesConfig(layerId: string, tilesetCount: number): GoesTileLayerConfig {
  return {
    layerId,
    type: LayerType.TILE,
    category: LayerCategory.GOES_19,
    availableTilesets: Array.from({ length: tilesetCount }, (_, i) => ({
      id: `t${i}`,
      time: new Date(0),
    })),
  };
}

function ecmwfConfig(
  layerId: string,
  forecastCount: number,
  tilesetCount: number,
): EcmwfTpTileLayerConfig {
  return {
    layerId,
    type: LayerType.TILE,
    category: LayerCategory.ECMWF_TP,
    availableTilesets: Array.from({ length: tilesetCount }, (_, i) => ({
      id: `t${i}`,
      time: new Date(0),
    })),
    availableForecasts: Array.from({ length: forecastCount }, (_, i) => `f${i}`),
    periodsByForecast: {},
    forecastsByPeriod: {},
  };
}

interface Mocks {
  configs: Map<string, LayerConfig>;
  probe: (layer: Layer) => Observable<boolean>;
  loadingLayerIds: ReturnType<typeof signal<ReadonlySet<string>>>;
  weatherStationsTilesetIds: string[];
  hasKey: boolean;
  keyChanges: ReturnType<typeof signal<number>>;
  allLayers: Layer[];
}

function setup(overrides: Partial<Mocks> = {}): {
  service: LayerAvailabilityService;
  mocks: Mocks;
} {
  const mocks: Mocks = {
    configs: overrides.configs ?? new Map(),
    probe: overrides.probe ?? ((_layer: Layer): Observable<boolean> => of(true)),
    loadingLayerIds: overrides.loadingLayerIds ?? signal<ReadonlySet<string>>(new Set()),
    weatherStationsTilesetIds: overrides.weatherStationsTilesetIds ?? [],
    hasKey: overrides.hasKey ?? false,
    keyChanges: overrides.keyChanges ?? signal(0),
    allLayers: overrides.allLayers ?? [],
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      LayerAvailabilityService,
      {
        provide: LayerConfigService,
        useValue: {
          hasConfig: (id: string) => mocks.configs.has(id),
          getConfig: (id: string) => mocks.configs.get(id),
          probeLayerAvailability: (layer: Layer) => mocks.probe(layer),
        },
      },
      {
        provide: LayerRefreshService,
        useValue: {
          loadingLayerIds: mocks.loadingLayerIds,
          getWeatherStationsAvailableTilesetIds: () => mocks.weatherStationsTilesetIds,
        },
      },
      {
        provide: LayersService,
        useValue: { getAllLayers: () => mocks.allLayers },
      },
      {
        provide: WeatherStationsApiKeyService,
        useValue: { hasKey: () => mocks.hasKey, keyChanges: mocks.keyChanges },
      },
    ],
  });

  return { service: TestBed.inject(LayerAvailabilityService), mocks };
}

// --------------------------------------------------------------------- specs

describe('LayerAvailabilityService — state() truth table', () => {
  it('derives from the live config when one exists (GOES with tilesets → available)', () => {
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 3)]]);
    const { service } = setup({ configs });
    expect(service.state(layer)).toBe('available');
    expect(service.isUnavailable(layer)).toBe(false);
  });

  it('reports empty when the live config has zero tilesets (GOES)', () => {
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 0)]]);
    const { service } = setup({ configs });
    expect(service.state(layer)).toBe('empty');
    expect(service.isUnavailable(layer)).toBe(true);
  });

  it('ECMWF availability keys off availableForecasts, NOT availableTilesets', () => {
    const layer = ecmwfLayer();
    // Zero forecasts but a non-empty selection-derived tileset list: still empty.
    const configs = new Map<string, LayerConfig>([[layer.id, ecmwfConfig(layer.id, 0, 5)]]);
    const { service } = setup({ configs });
    expect(service.state(layer)).toBe('empty');
  });

  it('ECMWF with at least one forecast is available even before a tileset selection', () => {
    const layer = ecmwfLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, ecmwfConfig(layer.id, 2, 0)]]);
    const { service } = setup({ configs });
    expect(service.state(layer)).toBe('available');
  });

  it('reports loading (never empty) while the first config is being fetched', () => {
    const layer = goesLayer();
    const loadingLayerIds = signal<ReadonlySet<string>>(new Set([layer.id]));
    const { service } = setup({ loadingLayerIds });
    expect(service.state(layer)).toBe('loading');
    expect(service.isUnavailable(layer)).toBe(false);
  });

  it('reports unknown (never empty) for an un-probed inactive layer', () => {
    const { service } = setup();
    expect(service.state(goesLayer())).toBe('unknown');
  });

  it('never greys WMS reference layers', () => {
    const { service } = setup();
    expect(service.state(wmsLayer())).toBe('available');
    expect(service.isUnavailable(wmsLayer())).toBe(false);
  });
});

describe('LayerAvailabilityService — weather stations', () => {
  it('is unknown (not greyed) when no API key is set', () => {
    const { service } = setup({ hasKey: false, weatherStationsTilesetIds: [] });
    expect(service.state(weatherStationsLayer())).toBe('unknown');
  });

  it('is available when a key is set and tilesets are present', () => {
    const { service } = setup({ hasKey: true, weatherStationsTilesetIds: ['20260101T0000Z'] });
    expect(service.state(weatherStationsLayer())).toBe('available');
  });

  it('stays unknown (never eagerly empty) when the tileset signal is empty', () => {
    const { service } = setup({ hasKey: true, weatherStationsTilesetIds: [] });
    expect(service.state(weatherStationsLayer())).toBe('unknown');
  });
});

describe('LayerAvailabilityService — primeAll probing', () => {
  it('marks probed layers available/empty from the probe result', async () => {
    const withData = goesLayer('goes/abi/ch-2');
    const withoutData = goesLayer('goes/abi/ch-9');
    const probe = vi.fn((layer: Layer) => of(layer.id === withData.id));
    const { service } = setup({ allLayers: [withData, withoutData], probe });

    service.primeAll();
    await flushMicrotasks();

    expect(service.state(withData)).toBe('available');
    expect(service.state(withoutData)).toBe('empty');
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('leaves a layer unknown (never empty) when its probe errors', async () => {
    const layer = goesLayer('goes/abi/ch-2');
    const probe = vi.fn(() => throwError(() => new Error('network')));
    const { service } = setup({ allLayers: [layer], probe });

    service.primeAll();
    await flushMicrotasks();

    expect(service.state(layer)).toBe('unknown');
  });

  it('does not probe layers that already have a live config', async () => {
    const active = goesLayer('goes/abi/ch-13');
    const configs = new Map<string, LayerConfig>([[active.id, goesConfig(active.id, 4)]]);
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: [active], configs, probe });

    service.primeAll();
    await flushMicrotasks();

    expect(probe).not.toHaveBeenCalled();
    expect(service.state(active)).toBe('available');
  });

  it('skips WMS layers when probing', async () => {
    const wms = wmsLayer();
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: [wms], probe });

    service.primeAll();
    await flushMicrotasks();

    expect(probe).not.toHaveBeenCalled();
  });
});

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}
