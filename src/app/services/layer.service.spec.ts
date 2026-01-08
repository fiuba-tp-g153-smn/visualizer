import { TestBed } from '@angular/core/testing';
import { LayerService } from './layer.service';
import { Layer } from '../models';

describe('LayerService', () => {
  let service: LayerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial state', () => {
    it('should have layer groups defined', () => {
      const groups = service.layerGroups();
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should have ABI satellite subgroup', () => {
      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      expect(satelliteGroup).toBeDefined();
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      expect(abiSubgroup).toBeDefined();
    });

    it('should have 3 ABI channels (ch2, ch9, ch13)', () => {
      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      expect(abiSubgroup?.layers.length).toBe(3);

      const layerIds = abiSubgroup?.layers.map((l) => l.id);
      expect(layerIds).toContain('abi-ch2');
      expect(layerIds).toContain('abi-ch9');
      expect(layerIds).toContain('abi-ch13');
    });

    it('should have all layers initially hidden', () => {
      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');

      abiSubgroup?.layers.forEach((layer) => {
        expect(layer.visible).toBe(false);
      });
    });

    it('should have activeLayers empty initially', () => {
      const active = service.activeLayers();
      expect(active.length).toBe(0);
    });
  });

  describe('toggleLayer', () => {
    it('should make layer visible when toggled from hidden', () => {
      service.toggleLayer('abi-ch13');

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      const layer = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');

      expect(layer?.visible).toBe(true);
    });

    it('should make layer hidden when toggled from visible', () => {
      service.toggleLayer('abi-ch13');
      service.toggleLayer('abi-ch13');

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      const layer = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');

      expect(layer?.visible).toBe(false);
    });

    it('should assign zIndex when making layer visible', () => {
      service.toggleLayer('abi-ch13');

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      const layer = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');

      expect(layer?.zIndex).toBeDefined();
    });

    it('should add layer to activeLayers when toggled visible', () => {
      service.toggleLayer('abi-ch13');

      const active = service.activeLayers();
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('abi-ch13');
    });

    it('should remove layer from activeLayers when toggled hidden', () => {
      service.toggleLayer('abi-ch13');
      service.toggleLayer('abi-ch13');

      const active = service.activeLayers();
      expect(active.length).toBe(0);
    });
  });

  describe('setOpacity', () => {
    it('should set opacity to specified value', () => {
      service.setOpacity('abi-ch13', 50);

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      const layer = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');

      expect(layer?.opacity).toBe(50);
    });

    it('should clamp opacity to 0 if value is negative', () => {
      service.setOpacity('abi-ch13', -10);

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      const layer = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');

      expect(layer?.opacity).toBe(0);
    });

    it('should clamp opacity to 100 if value exceeds 100', () => {
      service.setOpacity('abi-ch13', 150);

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');
      const layer = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');

      expect(layer?.opacity).toBe(100);
    });
  });

  describe('activeLayers computed', () => {
    it('should return layers ordered by zIndex', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch9');
      service.toggleLayer('abi-ch13');

      const active = service.activeLayers();

      expect(active.length).toBe(3);
      // Should be ordered by zIndex (assigned in order of activation)
      for (let i = 0; i < active.length - 1; i++) {
        const currentZ = active[i].zIndex ?? 0;
        const nextZ = active[i + 1].zIndex ?? 0;
        expect(currentZ).toBeLessThanOrEqual(nextZ);
      }
    });

    it('should only include visible layers', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch9');
      service.toggleLayer('abi-ch13');
      service.toggleLayer('abi-ch9'); // Hide ch9

      const active = service.activeLayers();

      expect(active.length).toBe(2);
      expect(active.find((l) => l.id === 'abi-ch9')).toBeUndefined();
    });
  });

  describe('moveLayerUp', () => {
    it('should increase zIndex when moving layer up', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch13');

      const activeBefore = service.activeLayers();
      const ch2Before = activeBefore.find((l) => l.id === 'abi-ch2');
      const zIndexBefore = ch2Before?.zIndex;

      service.moveLayerUp('abi-ch2');

      const activeAfter = service.activeLayers();
      const ch2After = activeAfter.find((l) => l.id === 'abi-ch2');

      expect(ch2After?.zIndex).toBeGreaterThan(zIndexBefore ?? 0);
    });

    it('should not move if layer is already on top', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch13');

      const activeBefore = service.activeLayers();
      const topLayer = activeBefore[activeBefore.length - 1];
      const zIndexBefore = topLayer.zIndex;

      service.moveLayerUp(topLayer.id);

      const activeAfter = service.activeLayers();
      const topLayerAfter = activeAfter.find((l) => l.id === topLayer.id);

      expect(topLayerAfter?.zIndex).toBe(zIndexBefore);
    });

    it('should do nothing if layer is not visible', () => {
      service.moveLayerUp('abi-ch2');

      const active = service.activeLayers();
      expect(active.length).toBe(0);
    });
  });

  describe('moveLayerDown', () => {
    it('should decrease zIndex when moving layer down', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch13');

      const activeBefore = service.activeLayers();
      const ch13Before = activeBefore.find((l) => l.id === 'abi-ch13');
      const zIndexBefore = ch13Before?.zIndex;

      service.moveLayerDown('abi-ch13');

      const activeAfter = service.activeLayers();
      const ch13After = activeAfter.find((l) => l.id === 'abi-ch13');

      expect(ch13After?.zIndex).toBeLessThan(zIndexBefore ?? 100);
    });

    it('should not move if layer is already on bottom', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch13');

      const activeBefore = service.activeLayers();
      const bottomLayer = activeBefore[0];
      const zIndexBefore = bottomLayer.zIndex;

      service.moveLayerDown(bottomLayer.id);

      const activeAfter = service.activeLayers();
      const bottomLayerAfter = activeAfter.find((l) => l.id === bottomLayer.id);

      expect(bottomLayerAfter?.zIndex).toBe(zIndexBefore);
    });
  });

  describe('setLayerOrder', () => {
    it('should reorder layers according to provided array', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch9');
      service.toggleLayer('abi-ch13');

      // Set new order: ch13 (bottom), ch2 (middle), ch9 (top)
      service.setLayerOrder(['abi-ch13', 'abi-ch2', 'abi-ch9']);

      const active = service.activeLayers();

      expect(active[0].id).toBe('abi-ch13');
      expect(active[1].id).toBe('abi-ch2');
      expect(active[2].id).toBe('abi-ch9');
    });

    it('should assign sequential zIndex values', () => {
      service.toggleLayer('abi-ch2');
      service.toggleLayer('abi-ch9');
      service.toggleLayer('abi-ch13');

      service.setLayerOrder(['abi-ch13', 'abi-ch2', 'abi-ch9']);

      const groups = service.layerGroups();
      const satelliteGroup = groups.find((g) => g.id === 'satellite');
      const abiSubgroup = satelliteGroup?.subgroups.find((s) => s.id === 'abi');

      const ch13 = abiSubgroup?.layers.find((l) => l.id === 'abi-ch13');
      const ch2 = abiSubgroup?.layers.find((l) => l.id === 'abi-ch2');
      const ch9 = abiSubgroup?.layers.find((l) => l.id === 'abi-ch9');

      expect(ch13?.zIndex).toBe(0);
      expect(ch2?.zIndex).toBe(1);
      expect(ch9?.zIndex).toBe(2);
    });
  });
});
