import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { LayerAvailabilityService } from './layer-availability.service';
import { LayerConfigService } from './layer-config.service';
import { LayerRefreshService } from './layer-refresh.service';
import { LayersService } from './layers.service';
import { DataServiceHealthService } from '../data-service-health/data-service-health.service';
import { WeatherStationsApiKeyService } from '../weather-stations/weather-stations-api-key.service';
import {
  ActiveLayerGroupId,
  EcmwfTpTileLayerConfig,
  GoesTileLayerConfig,
  Layer,
  LayerCategory,
  LayerConfig,
  LayerType,
  ProductAvailabilitySnapshot,
  WmsLayer,
} from '../../models';

// --------------------------------------------------------------------- helpers

function goesLayer(id = 'goes/abi/c13'): Layer {
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

function ecmwfLayer(id = 'ecmwf-ifs/total-precipitation'): Layer {
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
  availability: () => Observable<ProductAvailabilitySnapshot>;
  loadingLayerIds: ReturnType<typeof signal<ReadonlySet<string>>>;
  weatherStationsTilesetIds: string[];
  hasKey: boolean;
  keyChanges: ReturnType<typeof signal<number>>;
  allLayers: Layer[];
  isAvailable: ReturnType<typeof signal<boolean>>;
  reportFailure: ReturnType<typeof vi.fn>;
  checkNow: () => Promise<void>;
}

function setup(overrides: Partial<Mocks> = {}): {
  service: LayerAvailabilityService;
  mocks: Mocks;
} {
  const mocks: Mocks = {
    configs: overrides.configs ?? new Map(),
    probe: overrides.probe ?? ((_layer: Layer): Observable<boolean> => of(true)),
    // Default: the backend knows nothing, so every layer falls back to its
    // individual probe — which keeps the pre-bundling tests meaningful.
    availability:
      overrides.availability ??
      ((): Observable<ProductAvailabilitySnapshot> => of({ available: [], domains: [] })),
    loadingLayerIds: overrides.loadingLayerIds ?? signal<ReadonlySet<string>>(new Set()),
    weatherStationsTilesetIds: overrides.weatherStationsTilesetIds ?? [],
    hasKey: overrides.hasKey ?? false,
    keyChanges: overrides.keyChanges ?? signal(0),
    allLayers: overrides.allLayers ?? [],
    isAvailable: overrides.isAvailable ?? signal(true),
    reportFailure: overrides.reportFailure ?? vi.fn(),
    checkNow: overrides.checkNow ?? (async () => {}),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      LayerAvailabilityService,
      {
        provide: DataServiceHealthService,
        useValue: {
          isAvailable: mocks.isAvailable,
          reportFailure: mocks.reportFailure,
          checkNow: mocks.checkNow,
        },
      },
      {
        provide: LayerConfigService,
        useValue: {
          hasConfig: (id: string) => mocks.configs.has(id),
          getConfig: (id: string) => mocks.configs.get(id),
          probeLayerAvailability: (layer: Layer) => mocks.probe(layer),
          fetchProductAvailability: () => mocks.availability(),
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

  it('never greys WMS reference layers even when the data-service is down', () => {
    // WMS/IGN is a separate external server, unaffected by data-service health.
    const { service } = setup({ isAvailable: signal(false) });
    expect(service.state(wmsLayer())).toBe('available');
  });
});

describe('LayerAvailabilityService — data-service down greys unloaded products', () => {
  it('marks an unloaded TILE product unreachable while the service is down', () => {
    const layer = goesLayer();
    const { service } = setup({ isAvailable: signal(false) });
    expect(service.state(layer)).toBe('unreachable');
    expect(service.isUnavailable(layer)).toBe(true);
  });

  it('keeps an already-loaded product available even mid-outage (live config wins)', () => {
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 3)]]);
    const { service } = setup({ configs, isAvailable: signal(false) });
    expect(service.state(layer)).toBe('available');
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

  it('is unreachable when a key is set but the data-service is down', () => {
    const { service } = setup({
      hasKey: true,
      weatherStationsTilesetIds: [],
      isAvailable: signal(false),
    });
    expect(service.state(weatherStationsLayer())).toBe('unreachable');
  });

  it('stays unknown (not greyed) when there is no key, even if the service is down', () => {
    const { service } = setup({ hasKey: false, isAvailable: signal(false) });
    expect(service.state(weatherStationsLayer())).toBe('unknown');
  });
});

describe('LayerAvailabilityService — primeAll probing', () => {
  it('marks probed layers available/empty from the probe result', async () => {
    const withData = goesLayer('goes/abi/c02');
    const withoutData = goesLayer('goes/abi/c09');
    const probe = vi.fn((layer: Layer) => of(layer.id === withData.id));
    const { service } = setup({ allLayers: [withData, withoutData], probe });

    service.primeAll();
    await flushMicrotasks();

    expect(service.state(withData)).toBe('available');
    expect(service.state(withoutData)).toBe('empty');
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('leaves a layer unknown (never empty) when its probe errors', async () => {
    const layer = goesLayer('goes/abi/c02');
    const probe = vi.fn(() => throwError(() => new Error('network')));
    const { service } = setup({ allLayers: [layer], probe });

    service.primeAll();
    await flushMicrotasks();

    expect(service.state(layer)).toBe('unknown');
  });

  it('does not probe layers that already have a live config', async () => {
    const active = goesLayer('goes/abi/c13');
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

describe('LayerAvailabilityService — data-service health gating', () => {
  it('does not probe while the data-service is known to be down', async () => {
    const layer = goesLayer('goes/abi/c02');
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: [layer], probe, isAvailable: signal(false) });

    service.primeAll();
    await flushMicrotasks();

    expect(probe).not.toHaveBeenCalled();
    // Down + never loaded → unreachable (greyed), and no wasted probe request.
    expect(service.state(layer)).toBe('unreachable');
    expect(service.isUnavailable(layer)).toBe(true);
  });

  it('reports a network-level failure (status 0) to the health tracker', async () => {
    const layer = goesLayer('goes/abi/c02');
    const probe = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    const reportFailure = vi.fn();
    const { service } = setup({ allLayers: [layer], probe, reportFailure });

    service.primeAll();
    await flushMicrotasks();

    expect(reportFailure).toHaveBeenCalled();
    expect(service.state(layer)).toBe('unknown');
  });

  it('does not report a plain HTTP error (e.g. 404) as a service outage', async () => {
    const layer = goesLayer('goes/abi/c02');
    const probe = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    const reportFailure = vi.fn();
    const { service } = setup({ allLayers: [layer], probe, reportFailure });

    service.primeAll();
    await flushMicrotasks();

    expect(reportFailure).not.toHaveBeenCalled();
  });
});

describe('LayerAvailabilityService — manual recheck', () => {
  it('re-probes a single product when the service is up', async () => {
    const layer = goesLayer('goes/abi/c02');
    const probe = vi.fn(() => of(false));
    const { service } = setup({ allLayers: [layer], probe });

    await service.recheck(layer);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(service.state(layer)).toBe('empty');
  });

  it('forces a health check first when down, and re-probes once recovered', async () => {
    const layer = goesLayer('goes/abi/c02');
    const isAvailable = signal(false);
    const checkNow = vi.fn(async () => isAvailable.set(true)); // service comes back
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: [layer], probe, isAvailable, checkNow });

    await service.recheck(layer);

    expect(checkNow).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(service.state(layer)).toBe('available');
  });

  it('does not probe when the health recheck shows the service is still down', async () => {
    const layer = goesLayer('goes/abi/c02');
    const isAvailable = signal(false);
    const checkNow = vi.fn(async () => {}); // still down
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: [layer], probe, isAvailable, checkNow });

    await service.recheck(layer);

    expect(checkNow).toHaveBeenCalledTimes(1);
    expect(probe).not.toHaveBeenCalled();
    expect(service.state(layer)).toBe('unreachable');
  });
});

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

// ------------------------------------------------- bundled availability probe

function radarLayer(id = 'radar-sinarame/RMA2/dbzh'): Layer {
  return {
    id,
    name: 'Reflectividad',
    type: LayerType.TILE,
    category: LayerCategory.RADAR,
    zIndexGroup: ActiveLayerGroupId.BASE,
    availableElevations: [{ id: 'elev0', angle: 0.5, description: '0.5°' }],
  } as unknown as Layer;
}

describe('bundled availability snapshot', () => {
  it('resolves every product from ONE request instead of one per product', async () => {
    // The regression this replaces: 18 radars x 6 variables = 108 GETs a minute.
    const radars = Array.from({ length: 18 }, (_, r) =>
      ['dbzh', 'dbzh-450km', 'kdp', 'vrad', 'rhohv', 'zdr'].map((v) =>
        radarLayer(`radar-sinarame/RMA${r + 1}/${v}`),
      ),
    ).flat();
    const available = radars.map((layer) => `${layer.id}/elev0`);
    const probe = vi.fn(() => of(true));
    const availability = vi.fn(() => of({ available, domains: ['radar-sinarame'] }));
    const { service } = setup({ allLayers: radars, probe, availability });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(availability).toHaveBeenCalledTimes(1);
    expect(probe).not.toHaveBeenCalled();
    expect(service.state(radars[0])).toBe('available');
  });

  it('greys a product the snapshot omits, without probing it', async () => {
    // The snapshot is complete, so absence is an answer — not a reason to ask.
    const layer = radarLayer();
    const probe = vi.fn(() => of(true));
    const { service } = setup({
      allLayers: [layer],
      probe,
      availability: () => of({ available: [], domains: ['radar-sinarame'] }),
    });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.isUnavailable(layer)).toBe(true);
    expect(probe).not.toHaveBeenCalled();
  });

  it('probes nothing at all when most products are empty', async () => {
    // The regression: with ~125 products and only a handful carrying data, an
    // earlier design treated absence as "unknown" and probed the other ~113
    // every sweep — which is the entire cost the bundle exists to remove.
    const layers = Array.from({ length: 40 }, (_, i) => radarLayer(`radar-sinarame/RMA${i}/dbzh`));
    const probe = vi.fn(() => of(true));
    const { service } = setup({
      allLayers: layers,
      probe,
      availability: () =>
        of({ available: ['radar-sinarame/RMA0/dbzh/elev0'], domains: ['radar-sinarame'] }),
    });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(probe).not.toHaveBeenCalled();
    expect(service.state(layers[0])).toBe('available');
    expect(service.state(layers[7])).toBe('empty');
  });

  it('falls back to individual probes when the bundled call fails', async () => {
    const layer = goesLayer();
    const probe = vi.fn(() => of(true));
    const { service } = setup({
      allLayers: [layer],
      probe,
      availability: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('reports the service down when the bundled call fails at network level', async () => {
    const reportFailure = vi.fn();
    const { service } = setup({
      allLayers: [goesLayer()],
      reportFailure,
      availability: () => throwError(() => new HttpErrorResponse({ status: 0 })),
    });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(reportFailure).toHaveBeenCalled();
  });

  it('a single-product recheck stays a single probe, not the bundle', async () => {
    // The user pressed THIS product's button and wants its own fresh answer.
    const layer = goesLayer();
    const probe = vi.fn(() => of(true));
    const availability = vi.fn(() => of({ available: [], domains: [] }));
    const { service } = setup({ allLayers: [layer], probe, availability });

    await service.recheck(layer);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(availability).not.toHaveBeenCalled();
  });

  it('a subgroup recheck uses the bundle', async () => {
    const layers = [radarLayer('radar-sinarame/RMA2/dbzh'), radarLayer('radar-sinarame/RMA2/kdp')];
    const availability = vi.fn(() =>
      of({ available: ['radar-sinarame/RMA2/dbzh/elev0'], domains: ['radar-sinarame'] }),
    );
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: layers, probe, availability });

    await service.recheckMany(layers);

    expect(availability).toHaveBeenCalledTimes(1);
    expect(probe).not.toHaveBeenCalled();
    expect(service.state(layers[0])).toBe('available');
    expect(service.state(layers[1])).toBe('empty');
  });
});

// ------------------------------------------- stale config after deactivation

describe('a cached config that reports no data', () => {
  it('does not freeze the row as greyed after check-then-uncheck', async () => {
    // Activating a product before its first period exists caches an empty
    // config. That config is only refreshed while the layer is active, so on
    // deactivation it is stale — and it used to grey the row permanently,
    // because the eager sweep skipped anything holding a config at all.
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 0)]]);
    const { service } = setup({
      allLayers: [layer],
      configs,
      availability: () => of({ available: [layer.id], domains: ['goes'] }),
    });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.isUnavailable(layer)).toBe(false);
    expect(service.state(layer)).toBe('available');
  });

  it('defers instead of asserting empty before anything has checked', () => {
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 0)]]);
    const { service } = setup({ allLayers: [layer], configs });

    // Nothing has confirmed or denied it yet, so the row stays interactive
    // rather than being greyed on the strength of a stale config alone.
    expect(service.state(layer)).toBe('unknown');
    expect(service.isUnavailable(layer)).toBe(false);
  });

  it('greys the row once the snapshot confirms there is no data', async () => {
    // The row must still end up greyed when the product really is empty —
    // deferring is a delay, not a refusal to ever grey.
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 0)]]);
    const { service } = setup({
      allLayers: [layer],
      configs,
      availability: () => of({ available: [], domains: ['goes'] }),
    });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.state(layer)).toBe('empty');
    expect(service.isUnavailable(layer)).toBe(true);
  });

  it('lets a config that HAS data answer without any probe', async () => {
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 3)]]);
    const availability = vi.fn(() => of({ available: [], domains: [] }));
    const { service } = setup({ allLayers: [layer], configs, availability });

    service.primeAll();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.state(layer)).toBe('available');
    expect(availability).not.toHaveBeenCalled();
  });

  it('lets the recheck button work on a greyed row', async () => {
    const layer = goesLayer();
    const configs = new Map<string, LayerConfig>([[layer.id, goesConfig(layer.id, 0)]]);
    const probe = vi.fn(() => of(true));
    const { service } = setup({ allLayers: [layer], configs, probe });

    await service.recheck(layer);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(service.state(layer)).toBe('available');
  });
});
