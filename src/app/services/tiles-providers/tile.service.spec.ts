import { TestBed } from '@angular/core/testing';
import { TileService } from './tile.service';

describe('TileService', () => {
  let service: TileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial state', () => {
    it('should have ArgenMAP as default provider', () => {
      const currentProvider = service.currentProvider();
      expect(currentProvider.id).toBe('argenmap');
    });

    it('should return readonly current provider', () => {
      const provider = service.currentProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBeTruthy();
      expect(provider.url).toBeTruthy();
    });
  });

  describe('setProvider', () => {
    it('should change provider to OSM', () => {
      service.setProvider('osm');

      const currentProvider = service.currentProvider();
      expect(currentProvider.id).toBe('osm');
      expect(currentProvider.name).toBe('OpenStreetMap');
    });

    it('should change provider to satellite', () => {
      service.setProvider('satellite');

      const currentProvider = service.currentProvider();
      expect(currentProvider.id).toBe('satellite');
      expect(currentProvider.name).toBe('Satélite (ESRI)');
    });

    it('should change provider to CartoDB', () => {
      service.setProvider('cartoDB');

      const currentProvider = service.currentProvider();
      expect(currentProvider.id).toBe('cartoDB');
      expect(currentProvider.name).toBe('CartoDB Positron');
    });

    it('should change provider to CartoDB Dark', () => {
      service.setProvider('cartoDBDark');

      const currentProvider = service.currentProvider();
      expect(currentProvider.id).toBe('cartoDBDark');
      expect(currentProvider.name).toBe('CartoDB Dark Matter');
    });

    it('should return to ArgenMAP', () => {
      service.setProvider('osm');
      service.setProvider('argenmap');

      const currentProvider = service.currentProvider();
      expect(currentProvider.id).toBe('argenmap');
      expect(currentProvider.name).toBe('ArgenMAP (IGN)');
    });

    it('should throw error on invalid provider ID', () => {
      expect(() => {
        service.setProvider('invalid-id');
      }).toThrow("Tile provider 'invalid-id' not found");
    });
  });

  describe('getAvailableProviders', () => {
    it('should return array of all providers', () => {
      const providers = service.getAvailableProviders();

      expect(providers.length).toBe(5);
    });

    it('should include all expected providers', () => {
      const providers = service.getAvailableProviders();
      const ids = providers.map((p) => p.id);

      expect(ids).toContain('argenmap');
      expect(ids).toContain('osm');
      expect(ids).toContain('satellite');
      expect(ids).toContain('cartoDB');
      expect(ids).toContain('cartoDBDark');
    });

    it('should return providers with all required properties', () => {
      const providers = service.getAvailableProviders();

      providers.forEach((provider) => {
        expect(provider.id).toBeTruthy();
        expect(provider.name).toBeTruthy();
        expect(provider.url).toBeTruthy();
        expect(provider.attribution).toBeTruthy();
        expect(typeof provider.maxZoom).toBe('number');
      });
    });
  });

  describe('Provider switching behavior', () => {
    it('should maintain provider state across multiple reads', () => {
      service.setProvider('osm');

      const provider1 = service.currentProvider();
      const provider2 = service.currentProvider();

      expect(provider1.id).toBe(provider2.id);
      expect(provider1.name).toBe(provider2.name);
    });

    it('should emit new value when provider changes', () => {
      const providerBefore = service.currentProvider();
      service.setProvider('osm');
      const providerAfter = service.currentProvider();

      expect(providerBefore.id).not.toBe(providerAfter.id);
    });
  });
});
