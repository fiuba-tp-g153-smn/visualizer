import { describe, expect, it } from 'vitest';

import { RADAR_SUBGROUPS } from './config';
import { BoundingBox, Layer, RadarTileLayer } from '../../../models';

function radarLayers(): Layer[] {
  return RADAR_SUBGROUPS.flatMap((s) => (s.layers ?? []) as Layer[]);
}

describe('Radar layer labels', () => {
  it('never falls back to the raw product id', () => {
    // Product ids are lowercase for S3 and URL use. The label map used to be
    // Partial with a single entry, so every other product rendered its own id
    // and the layer panel showed dbzh / kdp / vrad in lowercase.
    for (const l of radarLayers()) {
      const product = l.id.split('/').pop() as string;
      expect(l.name).not.toBe(product);
    }
  });

  it('labels every product, with no empty names', () => {
    for (const l of radarLayers()) {
      expect(l.name?.trim()).toBeTruthy();
    }
  });
});

describe('Radar tile scheme', () => {
  it('is XYZ, which the tile prefetcher assumes when building warm URLs', () => {
    // TilePrefetchService.buildUrls emits Y un-flipped, matching what Leaflet
    // requests for a `tms: false` layer. It used to flip Y for radar only, so
    // every warmed URL was a mirrored tile the map never asked for — the
    // prefetch warmed 404-shaped miss placeholders and radar played back cold.
    // Flipping this flag without revisiting the prefetcher re-breaks that.
    for (const l of radarLayers()) {
      expect(l.tms ?? false).toBe(false);
    }
  });
});

describe('INTA long-range reflectivity', () => {
  function layer(id: string): RadarTileLayer {
    const found = radarLayers().find((l) => l.id === id);
    expect(found, id).toBeDefined();
    return found as RadarTileLayer;
  }

  function boxOf(id: string): BoundingBox {
    const box = layer(id).boundingBox;
    expect(box, id).toBeDefined();
    return box as BoundingBox;
  }

  it('is offered for every INTA radar, as a single 0.3° elevation', () => {
    // Every INTA site ships an .azi PPI; none is special-cased.
    for (const site of ['PAR', 'ANG', 'PER']) {
      const elevations = layer(`radar-inta/${site}/dbzh-450km`).availableElevations;
      expect(elevations.map((e) => [e.id, e.name])).toEqual([['elev0', '0.3°']]);
    }
  });

  it('keeps the SINARAME long-range elevation label at 0.5°', () => {
    const elevations = layer('radar-sinarame/RMA1/dbzh-450km').availableElevations;
    expect(elevations.map((e) => e.name)).toEqual(['0.5°']);
  });

  it('uses the box measured from each site’s own .azi range', () => {
    // Centre ± stoprange with the backend's cosine correction, rounded outward:
    // Anguil reaches 478.5 km and Pergamino 399.5 km.
    expect(boxOf('radar-inta/ANG/dbzh-450km')).toEqual([
      [-40.86, -69.36],
      [-32.22, -58.62],
    ]);
    expect(boxOf('radar-inta/PER/dbzh-450km')).toEqual([
      [-37.55, -64.91],
      [-30.34, -56.22],
    ]);
  });

  it('falls back to scaling the 240 km box for a site without a measured one', () => {
    const base = boxOf('radar-inta/PAR/dbzh');
    const [[latS, lngW], [latN, lngE]] = boxOf('radar-inta/PAR/dbzh-450km');
    const factor = 450 / 240;
    expect(latN - latS).toBeCloseTo((base[1][0] - base[0][0]) * factor, 6);
    expect(lngE - lngW).toBeCloseTo((base[1][1] - base[0][1]) * factor, 6);
  });
});
