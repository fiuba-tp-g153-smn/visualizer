import { describe, expect, it } from 'vitest';

import { adapterForLayer, forecastModelAdapter, hasRasterPyramid } from './forecast-model';
import { ForecastModelTileLayer, LayerCategory, LayerType } from '../../models';
import { ActiveLayerGroupId } from '../../models/layers/groups.models';

const CYCLE = '20260808T0600Z';
const INIT_TAG = '20260430_060000';

function modelLayer(overrides: Partial<ForecastModelTileLayer>): ForecastModelTileLayer {
  return {
    id: 'test/layer',
    name: 'Test',
    type: LayerType.TILE,
    category: LayerCategory.WRF,
    zIndexGroup: ActiveLayerGroupId.BASE,
    productId: 'p',
    minNativeZoom: 3,
    maxNativeZoom: 7,
    isForecast: true,
    ...overrides,
  } as ForecastModelTileLayer;
}

describe('forecastModelAdapter', () => {
  it('falls back to WRF when a layer declares no model', () => {
    // Las capas WRF fueron las únicas con esta forma antes de GFS y por eso no
    // marcan `modelId`; si el default cambiara, sus URLs apuntarían a GFS.
    expect(adapterForLayer(modelLayer({})).id).toBe('wrf');
  });

  it('routes GFS layers to the GFS adapter', () => {
    expect(adapterForLayer(modelLayer({ modelId: 'gfs' })).id).toBe('gfs');
  });
});

describe('GFS adapter URLs', () => {
  const gfs = forecastModelAdapter('gfs');

  it('builds a tile template with Leaflet placeholders', () => {
    expect(gfs.buildTileUrl('500hpa', CYCLE, 'f003')).toContain(
      `/products/gfs/500hpa/${CYCLE}/f003/{z}/{x}/{y}.webp`,
    );
  });

  it('builds a barb tile URL with concrete coordinates', () => {
    expect(gfs.buildBarbTileUrl('500hpa', CYCLE, 'f003', 4, 5, 9)).toContain(
      `/products/gfs/500hpa/${CYCLE}/f003/barbs/4/5/9.json`,
    );
  });

  it('builds a point query URL', () => {
    expect(gfs.buildPointQueryUrl('mslp', CYCLE, 'f000', -34.5, -64.25)).toContain(
      `/products/gfs/mslp/${CYCLE}/f000/point?lat=-34.5&lon=-64.25`,
    );
  });

  it('builds a secondary point query URL', () => {
    expect(
      gfs.buildSecondaryPointQueryUrl('500hpa', CYCLE, 'f003', 'geopotential', -34.5, -64.25),
    ).toContain(
      `/products/gfs/500hpa/${CYCLE}/f003/secondary/geopotential/point?lat=-34.5&lon=-64.25`,
    );
  });
});

describe('secondary point queries per model', () => {
  it('sends each model to its own route', () => {
    const gfsUrl = forecastModelAdapter('gfs').buildSecondaryPointQueryUrl(
      '500hpa',
      CYCLE,
      'f003',
      'temperature',
      -34.5,
      -64.25,
    );
    const wrfUrl = forecastModelAdapter('wrf').buildSecondaryPointQueryUrl(
      'MUCAPE',
      INIT_TAG,
      'F003',
      'shear_850_500',
      -34.5,
      -64.25,
    );

    expect(gfsUrl).toContain('/products/gfs/');
    expect(wrfUrl).toContain('/products/wrf/');
  });
});

describe('run listings', () => {
  it('reads GFS cycles', () => {
    const response = { cycles: [{ cycle: CYCLE, step_count: 33 }] };
    expect(forecastModelAdapter('gfs').readRunTags(response)).toEqual([CYCLE]);
  });

  it('reads WRF init runs', () => {
    const response = { init_runs: [{ init_tag: INIT_TAG, step_count: 72 }] };
    expect(forecastModelAdapter('wrf').readRunTags(response)).toEqual([INIT_TAG]);
  });

  it('treats a listing with no runs as empty rather than throwing', () => {
    // El data-service responde 200 con la lista vacía mientras el sync todavía
    // no encontró corridas; la UI debe quedar vacía, no romperse.
    expect(forecastModelAdapter('gfs').readRunTags({})).toEqual([]);
    expect(forecastModelAdapter('wrf').readRunTags({})).toEqual([]);
  });
});

describe('GFS step timestamps', () => {
  const gfs = forecastModelAdapter('gfs');

  it('parses a cycle tag as UTC', () => {
    expect(gfs.parseRunTag(CYCLE)?.toISOString()).toBe('2026-08-08T06:00:00.000Z');
  });

  it('rejects a tag that is not in cycle format', () => {
    expect(gfs.parseRunTag(INIT_TAG)).toBeNull();
  });

  it('offsets a step by its forecast hours', () => {
    expect(gfs.parseStepTimestamp(CYCLE, 'f003')?.toISOString()).toBe('2026-08-08T09:00:00.000Z');
  });

  it('round-trips every step of a cycle', () => {
    // La corrida trae 33 pasos: 3-horarios hasta +48h y 6-horarios hasta +144h.
    // El timeline se keya por instante absoluto y la URL necesita volver al
    // fxxx, así que ida y vuelta tienen que coincidir en los dos tramos.
    const hours = [
      ...Array.from({ length: 17 }, (_, i) => i * 3),
      ...Array.from({ length: 16 }, (_, i) => 54 + i * 6),
    ];
    for (const hour of hours) {
      const fxxx = `f${String(hour).padStart(3, '0')}`;
      const time = gfs.parseStepTimestamp(CYCLE, fxxx);
      expect(time).not.toBeNull();
      expect(gfs.fxxxForRunAndTime(CYCLE, time!)).toBe(fxxx);
    }
  });

  it('pads the step to three digits', () => {
    const time = new Date(Date.UTC(2026, 7, 8, 9, 0, 0));
    expect(gfs.fxxxForRunAndTime(CYCLE, time)).toBe('f003');
  });

  it('has no step for an instant before the cycle', () => {
    const time = new Date(Date.UTC(2026, 7, 8, 3, 0, 0));
    expect(gfs.fxxxForRunAndTime(CYCLE, time)).toBeNull();
  });

  it('keeps the WRF and GFS step formats apart', () => {
    // WRF rotula 'F003' y GFS 'f003'; cruzarlos daría 404 en todos los tiles.
    const time = new Date(Date.UTC(2026, 7, 8, 9, 0, 0));
    expect(forecastModelAdapter('gfs').fxxxForRunAndTime(CYCLE, time)).toBe('f003');
    expect(forecastModelAdapter('wrf').fxxxForRunAndTime(INIT_TAG, new Date(0))).toBeNull();
  });
});

describe('hasRasterPyramid', () => {
  it('defaults to true when the layer says nothing', () => {
    expect(hasRasterPyramid(modelLayer({}))).toBe(true);
  });

  it('is false only when explicitly disabled', () => {
    expect(hasRasterPyramid(modelLayer({ hasRaster: false }))).toBe(false);
  });
});
