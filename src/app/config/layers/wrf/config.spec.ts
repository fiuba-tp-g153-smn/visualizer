import { describe, expect, it } from 'vitest';

import { WRF_SUBGROUP } from './config';
import { buildConfigUrl } from '../../backend.config';
import { ForecastModelTileLayer } from '../../../models';

const LAYERS = WRF_SUBGROUP.layers as ForecastModelTileLayer[];

describe('WRF layer routing', () => {
  it('keeps the layer id and the API product segment in sync', () => {
    // `buildConfigUrl` is called with the raw layer id, so the id prefix and the
    // data-service router prefix are one contract. When they drifted apart the
    // config request 404'd, no init_runs came back, and every WRF layer silently
    // rendered nothing: layer-availability maps a real HTTP status to 'unknown',
    // so the row still looked healthy. GFS has this guard; WRF did not.
    for (const l of LAYERS) {
      expect(l.id).toBe(`wrf-arg4k/${l.productId}`);
    }
  });

  it('points the config URL at a path data-service actually serves', () => {
    for (const l of LAYERS) {
      expect(buildConfigUrl(l.id)).toContain(`/products/wrf-arg4k/${l.productId}`);
    }
  });

  it('gives every product a display name distinct from its id', () => {
    // A blanket rename once lowercased three labels into their own ids.
    for (const l of LAYERS) {
      expect(l.name).not.toBe(l.productId);
    }
  });
});
