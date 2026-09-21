import { describe, expect, it } from 'vitest';

import { RADAR_SUBGROUPS } from './config';
import { Layer } from '../../../models';

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
