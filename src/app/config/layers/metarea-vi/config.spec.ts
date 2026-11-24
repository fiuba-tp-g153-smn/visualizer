import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { METAREA_VI_DATA_URL, METAREA_VI_SUBGROUP } from './config';
import { LAYER_DEFINITIONS } from '../layer-definitions';
import { ActiveLayerGroupId, LayerCategory, LayerType, StaticVectorLayer } from '../../../models';
import { LayersService } from '../../../services/layers/layers.service';

describe('Metarea VI menu registration', () => {
  it('is its own group, right after "IGN Argentina"', () => {
    const ids = LAYER_DEFINITIONS.map((group) => group.id);
    expect(ids.indexOf('metarea-vi')).toBe(ids.indexOf('ign-wms') + 1);
  });

  it('holds a single static vector layer in the reference band', () => {
    const group = LAYER_DEFINITIONS.find((g) => g.id === 'metarea-vi');
    const layers = group?.subgroups.flatMap((s) => s.layers) ?? [];

    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({
      id: 'metarea-vi',
      name: 'Metarea VI',
      type: LayerType.VECTOR,
      category: LayerCategory.METAREA_VI,
      zIndexGroup: ActiveLayerGroupId.OVERLAY,
    });
  });

  it('reads the same-origin GeoJSON built by scripts/metarea-vi', () => {
    const layer = METAREA_VI_SUBGROUP.layers[0] as StaticVectorLayer;
    expect(layer.dataUrl).toBe(METAREA_VI_DATA_URL);
    expect(METAREA_VI_DATA_URL).toBe('/geo/metarea-vi.json');
  });

  it('has a full display name (no "Unknown layer category")', () => {
    const service = TestBed.inject(LayersService);
    const layer = service.getLayerById('metarea-vi');

    expect(layer).toBeDefined();
    expect(service.getLayerFullName(layer!)).toBe('Metarea VI');
  });
});
