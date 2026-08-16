import { describe, expect, it } from 'vitest';

import { GFS_SUBGROUP } from './config';
import { LAYER_DEFINITIONS } from '../layer-definitions';
import { BarbTileRender, ForecastModelTileLayer, SecondaryVectorRender } from '../../../models';
import { adapterForLayer, hasRasterPyramid } from '../forecast-model';

const LAYERS = GFS_SUBGROUP.layers as ForecastModelTileLayer[];

function layer(id: string): ForecastModelTileLayer {
  const found = LAYERS.find((l) => l.id === id);
  if (!found) throw new Error(`GFS layer '${id}' not found`);
  return found;
}

function isBarb(render: SecondaryVectorRender | BarbTileRender): render is BarbTileRender {
  return 'kind' in render && render.kind === 'barb-tile';
}

describe('GFS menu registration', () => {
  it('appears as a subgroup of "Modelos"', () => {
    const models = LAYER_DEFINITIONS.find((group) => group.id === 'modelos');
    expect(models?.subgroups.map((s) => s.id)).toContain('gfs');
  });

  it('publishes the three SMN charts', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['gfs/mslp', 'gfs/500hpa', 'gfs/250hpa']);
  });
});

describe('GFS layer routing', () => {
  it('routes every layer through the GFS adapter', () => {
    for (const l of LAYERS) {
      expect(adapterForLayer(l).id).toBe('gfs');
    }
  });

  it('keeps the layer id and the API product segment in sync', () => {
    for (const l of LAYERS) {
      expect(l.id).toBe(`gfs/${l.productId}`);
    }
  });

  it('uses the zoom range that tiles-processor recorta', () => {
    for (const l of LAYERS) {
      expect(l.minNativeZoom).toBe(3);
      expect(l.maxNativeZoom).toBe(7);
    }
  });
});

describe('presión a nivel del mar', () => {
  const mslp = () => layer('gfs/mslp');

  it('declares no raster pyramid', () => {
    expect(hasRasterPyramid(mslp())).toBe(false);
  });

  it('carries a point-query range despite having no colour scale', () => {
    expect(mslp().scale).toBeUndefined();
    expect(mslp().pointQueryScaleRange).toBeDefined();
  });

  it('draws isobars and thickness', () => {
    const ids = (mslp().secondaryRenders ?? []).map((r) => r.id);
    expect(ids).toEqual(['gfs-mslp-thickness', 'gfs-mslp-isobars']);
  });

  it('highlights the four air-mass thickness levels the SMN charts colour', () => {
    const thickness = (mslp().secondaryRenders ?? []).find(
      (r) => r.id === 'gfs-mslp-thickness',
    ) as SecondaryVectorRender;
    const plain = thickness.styleFor(5340);
    for (const level of [5280, 5400, 5580, 5700]) {
      expect(thickness.styleFor(level).color).not.toBe(plain.color);
      expect(thickness.styleFor(level).weight).toBeGreaterThan(plain.weight);
    }
  });
});

describe('niveles isobáricos', () => {
  it('shades wind speed on both levels', () => {
    expect(layer('gfs/500hpa').scale).toBeDefined();
    expect(layer('gfs/250hpa').scale).toBeDefined();
    expect(hasRasterPyramid(layer('gfs/500hpa'))).toBe(true);
    expect(hasRasterPyramid(layer('gfs/250hpa'))).toBe(true);
  });

  it('puts the barbs last so they stack above the contours', () => {
    const renders = layer('gfs/500hpa').secondaryRenders ?? [];
    expect(renders.filter(isBarb)).toHaveLength(1);
    expect(isBarb(renders[renders.length - 1])).toBe(true);
  });

  it('only 500 hPa carries barbs', () => {
    expect((layer('gfs/250hpa').secondaryRenders ?? []).filter(isBarb)).toHaveLength(0);
    expect((layer('gfs/mslp').secondaryRenders ?? []).filter(isBarb)).toHaveLength(0);
  });

  it('reads each contour from the property tiles-processor writes', () => {
    const byId = new Map<string, string>();
    for (const l of LAYERS) {
      for (const render of l.secondaryRenders ?? []) {
        if (!isBarb(render)) byId.set(render.id, render.valueProperty);
      }
    }
    expect(byId.get('gfs-mslp-isobars')).toBe('pressure_hpa');
    expect(byId.get('gfs-mslp-thickness')).toBe('thickness_gpm');
    expect(byId.get('gfs-500hpa-heights')).toBe('height_gpm');
    expect(byId.get('gfs-500hpa-isotherms')).toBe('temp_c');
    expect(byId.get('gfs-250hpa-heights')).toBe('height_gpm');
  });

  it('names every overlay exactly as its URL does', () => {
    for (const l of LAYERS) {
      for (const render of l.secondaryRenders ?? []) {
        if (isBarb(render)) continue;
        expect(render.backendLayerName).toBeDefined();
        expect(render.buildUrl('20260808T0600Z', 'f003')).toContain(
          `/${render.backendLayerName}.json`,
        );
      }
    }
  });

  it('points every overlay at its own product', () => {
    for (const l of LAYERS) {
      for (const render of l.secondaryRenders ?? []) {
        if (isBarb(render)) continue;
        expect(render.buildUrl('20260808T0600Z', 'f003')).toContain(
          `/products/gfs/${l.productId}/20260808T0600Z/f003/`,
        );
      }
    }
  });
});
