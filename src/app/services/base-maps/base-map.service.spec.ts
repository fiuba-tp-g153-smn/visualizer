import { TestBed } from '@angular/core/testing';
import { BaseMapService } from './base-map.service';

describe('BaseMapService', () => {
  let service: BaseMapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BaseMapService);
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial state', () => {
    it('should have Argenmap as default base map', () => {
      const currentBaseMap = service.currentBaseMap();
      expect(currentBaseMap.id).toBe('argenmap');
    });

    it('should return readonly current base map', () => {
      const baseMap = service.currentBaseMap();
      expect(baseMap).toBeDefined();
      expect(baseMap.name).toBeTruthy();
      expect(baseMap.url).toBeTruthy();
    });
  });

  describe('setBaseMap', () => {
    it('should change base map to Argenmap gris', () => {
      service.setBaseMap('argenmapGris');

      const currentBaseMap = service.currentBaseMap();
      expect(currentBaseMap.id).toBe('argenmapGris');
      expect(currentBaseMap.name).toBe('Argenmap gris');
    });

    it('should change base map to satellite', () => {
      service.setBaseMap('satellite');

      const currentBaseMap = service.currentBaseMap();
      expect(currentBaseMap.id).toBe('satellite');
      expect(currentBaseMap.name).toBe('Satélite');
    });

    it('should change base map to topographic', () => {
      service.setBaseMap('topographic');

      const currentBaseMap = service.currentBaseMap();
      expect(currentBaseMap.id).toBe('topographic');
      expect(currentBaseMap.name).toBe('Topográfico');
    });

    it('should return to Argenmap', () => {
      service.setBaseMap('satellite');
      service.setBaseMap('argenmap');

      const currentBaseMap = service.currentBaseMap();
      expect(currentBaseMap.id).toBe('argenmap');
      expect(currentBaseMap.name).toBe('Argenmap');
    });

    it('should throw error on invalid base map ID', () => {
      expect(() => {
        service.setBaseMap('invalid-id');
      }).toThrow("Base map 'invalid-id' not found");
    });

    it('should persist base map selection to localStorage', () => {
      service.setBaseMap('satellite');

      const stored = localStorage.getItem('mapasmn_selected_base_map');
      expect(stored).toBe('satellite');
    });
  });

  describe('getAvailableBaseMaps', () => {
    it('should return array of all base maps', () => {
      const baseMaps = service.getAvailableBaseMaps();

      expect(baseMaps.length).toBe(8);
    });

    it('should include all expected base maps', () => {
      const baseMaps = service.getAvailableBaseMaps();
      const ids = baseMaps.map((p) => p.id);

      expect(ids).toContain('argenmap');
      expect(ids).toContain('argenmapGris');
      expect(ids).toContain('argenmapOscuro');
      expect(ids).toContain('argenmapTopografico');
      expect(ids).toContain('satellite');
      expect(ids).toContain('topographic');
      expect(ids).toContain('googleSatellite');
      expect(ids).toContain('oceanBase');
    });

    it('should return base maps with all required properties', () => {
      const baseMaps = service.getAvailableBaseMaps();

      baseMaps.forEach((baseMap) => {
        expect(baseMap.id).toBeTruthy();
        expect(baseMap.name).toBeTruthy();
        expect(baseMap.url).toBeTruthy();
        expect(baseMap.attribution).toBeTruthy();
        expect(typeof baseMap.maxZoom).toBe('number');
      });
    });
  });

  describe('Base map switching behavior', () => {
    it('should maintain base map state across multiple reads', () => {
      service.setBaseMap('satellite');

      const baseMap1 = service.currentBaseMap();
      const baseMap2 = service.currentBaseMap();

      expect(baseMap1.id).toBe(baseMap2.id);
      expect(baseMap1.name).toBe(baseMap2.name);
    });

    it('should emit new value when base map changes', () => {
      const baseMapBefore = service.currentBaseMap();
      service.setBaseMap('satellite');
      const baseMapAfter = service.currentBaseMap();

      expect(baseMapBefore.id).not.toBe(baseMapAfter.id);
    });
  });

  describe('localStorage persistence', () => {
    it('should load basemap from localStorage on initialization', () => {
      localStorage.setItem('mapasmn_selected_base_map', 'satellite');

      const newService = TestBed.inject(BaseMapService);
      expect(newService.currentBaseMap().id).toBe('satellite');
    });

    it('should fallback to default if stored ID is invalid', () => {
      localStorage.setItem('mapasmn_selected_base_map', 'invalid-id');

      const newService = TestBed.inject(BaseMapService);
      expect(newService.currentBaseMap().id).toBe('argenmap');
    });
  });
});
