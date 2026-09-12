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
