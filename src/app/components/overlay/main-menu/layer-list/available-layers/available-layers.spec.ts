import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AvailableLayersComponent } from './available-layers';
import { LayersService } from '../../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../../services/layers/layer-control.service';
import { LayerAvailabilityService } from '../../../../../services/layers/layer-availability.service';
import { Layer, LayerGroup, LayerSubgroup } from '../../../../../models';

// --------------------------------------------------------------------- helpers

function layer(id: string): Layer {
  return { id, name: id } as unknown as Layer;
}

function subgroup(id: string, layerIds: string[]): LayerSubgroup {
  return { id, name: id, layers: layerIds.map(layer) } as unknown as LayerSubgroup;
}

function group(id: string, subgroups: LayerSubgroup[]): LayerGroup {
  return { id, name: id, subgroups } as unknown as LayerGroup;
}

interface Harness {
  component: AvailableLayersComponent;
  recheckMany: ReturnType<typeof vi.fn>;
}

function setup(unavailableIds: string[]): Harness {
  const unavailable = new Set(unavailableIds);
  const recheckMany = vi.fn(async () => {});
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LayersService, useValue: { getLayerGroups: () => [] } },
      { provide: LayerControlService, useValue: { getControls: () => undefined } },
      {
        provide: LayerAvailabilityService,
        useValue: { isUnavailable: (l: Layer) => unavailable.has(l.id), recheckMany },
      },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AvailableLayersComponent());
  return { component, recheckMany };
}

// --------------------------------------------------------------------- specs

describe('AvailableLayersComponent — Phase 3 header dimming', () => {
  describe('isSubgroupUnavailable', () => {
    it('is true only when every layer in the subgroup is unavailable', () => {
      const { component } = setup(['a', 'b']);
      expect(component.isSubgroupUnavailable(subgroup('sg', ['a', 'b']))).toBe(true);
    });

    it('is false when at least one layer still has data', () => {
      const { component } = setup(['a']);
      expect(component.isSubgroupUnavailable(subgroup('sg', ['a', 'b']))).toBe(false);
    });

    it('is false for an empty subgroup (no layers to be unavailable)', () => {
      const { component } = setup([]);
      expect(component.isSubgroupUnavailable(subgroup('sg', []))).toBe(false);
    });
  });

  describe('isGroupUnavailable', () => {
    it('is true when every layer across all subgroups is unavailable', () => {
      const { component } = setup(['a', 'b', 'c']);
      const g = group('g', [subgroup('s1', ['a', 'b']), subgroup('s2', ['c'])]);
      expect(component.isGroupUnavailable(g)).toBe(true);
    });

    it('is false when one subgroup still has an available layer', () => {
      const { component } = setup(['a', 'b']); // 'c' still available
      const g = group('g', [subgroup('s1', ['a', 'b']), subgroup('s2', ['c'])]);
      expect(component.isGroupUnavailable(g)).toBe(false);
    });
  });
});

describe('AvailableLayersComponent — subgroup recheck', () => {
  it('shows the recheck affordance only when a subgroup has an unavailable layer', () => {
    const { component } = setup(['a']);
    expect(component.subgroupHasUnavailableLayer(subgroup('sg', ['a', 'b']))).toBe(true);
    expect(component.subgroupHasUnavailableLayer(subgroup('sg2', ['b', 'c']))).toBe(false);
  });

  it('rechecks every layer in the subgroup and toggles its in-flight flag', async () => {
    const { component, recheckMany } = setup(['a', 'b']);
    const sg = subgroup('sg', ['a', 'b']);
    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;

    const pending = component.recheckSubgroup(sg, event);
    expect(component.isSubgroupRechecking('sg')).toBe(true);

    await pending;

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(recheckMany).toHaveBeenCalledWith(sg.layers);
    expect(component.isSubgroupRechecking('sg')).toBe(false);
  });

  it('ignores a second recheck while one is already in flight', async () => {
    const { component, recheckMany } = setup(['a']);
    const sg = subgroup('sg', ['a']);
    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;

    const first = component.recheckSubgroup(sg, event);
    await component.recheckSubgroup(sg, event); // in-flight → no-op
    await first;

    expect(recheckMany).toHaveBeenCalledTimes(1);
  });
});
