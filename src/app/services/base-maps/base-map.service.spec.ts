import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BaseMapService } from './base-map.service';
import { STORAGE_KEYS } from '../../constants';
import { MAP_CONFIG, buildBasemapProvidersUrl } from '../../config';
import type { BaseMapProvidersResponse } from '../../config';

const SAMPLE_RESPONSE: BaseMapProvidersResponse = {
  providers: [
    {
      id: 'argenmap',
      name: 'Argenmap',
      min_zoom: 3,
      max_zoom: 21,
      cache_max_zoom: 11,
      attribution: 'Instituto Geográfico Nacional + OpenStreetMap contributors',
    },
    {
      id: 'satellite',
      name: 'Imágenes satelitales Esri',
      min_zoom: 3,
      max_zoom: 17,
      cache_max_zoom: 11,
      attribution: 'Tiles © Esri',
    },
  ],
};

describe('BaseMapService', () => {
  let service: BaseMapService;
  let httpMock: HttpTestingController;

  function flushProviders(response: BaseMapProvidersResponse = SAMPLE_RESPONSE): void {
    const req = httpMock.expectOne(buildBasemapProvidersUrl());
    expect(req.request.method).toBe('GET');
    req.flush(response);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BaseMapService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and request the providers list at init', () => {
    expect(service).toBeTruthy();
    expect(service.loadState()).toBe('loading');
    flushProviders();
    expect(service.loadState()).toBe('loaded');
  });

  describe('After providers load', () => {
    beforeEach(() => {
      flushProviders();
    });

    it('exposes the providers from the API', () => {
      expect(service.providers().length).toBe(2);
      expect(service.providers().map((p) => p.id)).toEqual(['argenmap', 'satellite']);
    });

    it('exposes upstream max_zoom as the fetch ceiling and the map display cap as the visible ceiling', () => {
      const argenmap = service.providers().find((p) => p.id === 'argenmap')!;
      // Lets Leaflet request tiles past cache_max_zoom; backend relays.
      expect(argenmap.maxNativeZoom).toBe(21);
      expect(argenmap.maxZoom).toBe(MAP_CONFIG.maxZoom);
    });

    it('wraps known attribution patterns with anchor tags', () => {
      const argenmap = service.providers().find((p) => p.id === 'argenmap')!;
      expect(argenmap.attribution).toContain('<a href="');
      expect(argenmap.attribution).toContain('Instituto Geográfico Nacional</a>');
      expect(argenmap.attribution).toContain('OpenStreetMap</a>');
    });

    it('selects the default base map when no preference is stored', () => {
      expect(service.currentBaseMap()?.id).toBe('argenmap');
    });

    it('changes the current base map via setBaseMap', () => {
      service.setBaseMap('satellite');
      expect(service.currentBaseMap()?.id).toBe('satellite');
    });

    it('ignores unknown ids without throwing', () => {
      service.setBaseMap('does-not-exist');
      expect(service.currentBaseMap()?.id).toBe('argenmap');
    });

    it('persists the selection to localStorage', () => {
      service.setBaseMap('satellite');
      TestBed.tick();
      expect(localStorage.getItem(STORAGE_KEYS.BASE_MAP)).toBe('satellite');
    });
  });

  describe('Empty provider list', () => {
    it('clears the current base map and reports loaded state', () => {
      flushProviders({ providers: [] });
      expect(service.providers().length).toBe(0);
      expect(service.currentBaseMap()).toBeNull();
      expect(service.loadState()).toBe('loaded');
      expect(service.hasProviders()).toBe(false);
    });
  });

  describe('API failure', () => {
    it('reports error state without falling back to a hardcoded list', () => {
      const req = httpMock.expectOne(buildBasemapProvidersUrl());
      req.error(new ProgressEvent('error'), { status: 503, statusText: 'Service Unavailable' });
      expect(service.loadState()).toBe('error');
      expect(service.providers().length).toBe(0);
      expect(service.currentBaseMap()).toBeNull();
    });
  });
});

describe('BaseMapService — persisted preference', () => {
  function bootWithStoredId(storedId: string | null) {
    localStorage.clear();
    if (storedId) localStorage.setItem(STORAGE_KEYS.BASE_MAP, storedId);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(BaseMapService);
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(buildBasemapProvidersUrl()).flush(SAMPLE_RESPONSE);
    return { service, httpMock };
  }

  it('restores a stored base map id once providers load', () => {
    const { service, httpMock } = bootWithStoredId('satellite');
    expect(service.currentBaseMap()?.id).toBe('satellite');
    httpMock.verify();
  });

  it('falls back to the default if the stored id is not in the list', () => {
    const { service, httpMock } = bootWithStoredId('unknown');
    expect(service.currentBaseMap()?.id).toBe('argenmap');
    httpMock.verify();
  });
});
