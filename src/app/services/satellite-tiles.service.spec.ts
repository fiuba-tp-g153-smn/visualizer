import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SatelliteTilesService } from './satellite-tiles.service';
import { ApiConfigService } from './api-config.service';
import { TileProductsResponse } from '../models/map-data.models';

describe('SatelliteTilesService', () => {
  let service: SatelliteTilesService;
  let httpMock: HttpTestingController;
  let apiConfig: ApiConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SatelliteTilesService,
        ApiConfigService,
      ],
    });

    service = TestBed.inject(SatelliteTilesService);
    httpMock = TestBed.inject(HttpTestingController);
    apiConfig = TestBed.inject(ApiConfigService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAvailableProducts', () => {
    it('should return list of tile products', (done) => {
      const mockResponse: TileProductsResponse = {
        products: [
          {
            name: 'ash_rgb_202601080150',
            path: '/path/to/tiles',
            tile_format: 'webp',
            zoom_levels: [4, 5, 6, 7, 8],
          },
        ],
        tile_url_template: 'http://localhost:5000/tiles/{product_name}/{z}/{x}/{y}.webp',
      };

      service.getAvailableProducts().subscribe((products) => {
        expect(products).toEqual(mockResponse.products);
        expect(products.length).toBe(1);
        expect(products[0].name).toBe('ash_rgb_202601080150');
        done();
      });

      const req = httpMock.expectOne(apiConfig.getTileProductsUrl());
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should handle errors and return empty array', (done) => {
      service.getAvailableProducts().subscribe((products) => {
        expect(products).toEqual([]);
        done();
      });

      const req = httpMock.expectOne(apiConfig.getTileProductsUrl());
      req.error(new ProgressEvent('error'));
    });
  });

  describe('createTileLayer', () => {
    it('should create tile layer with correct configuration', () => {
      const mockProduct = {
        name: 'ash_rgb_202601080150',
        path: '/path/to/tiles',
        tile_format: 'webp',
        zoom_levels: [4, 5, 6, 7, 8, 9],
      };

      const layer = service.createTileLayer(mockProduct);

      expect(layer.id).toBe('tile-ash_rgb_202601080150');
      expect(layer.productName).toBe('ash_rgb_202601080150');
      expect(layer.minZoom).toBe(4);
      expect(layer.maxZoom).toBe(8);
      expect(layer.opacity).toBe(0.8);
      expect(layer.urlTemplate).toContain('ash_rgb_202601080150');
    });

    it('should apply custom options', () => {
      const mockProduct = {
        name: 'test_product',
        path: '/path',
        tile_format: 'png',
        zoom_levels: [0, 1, 2],
      };

      const layer = service.createTileLayer(mockProduct, {
        opacity: 0.5,
        attribution: 'Custom Attribution',
      });

      expect(layer.opacity).toBe(0.5);
      expect(layer.attribution).toBe('Custom Attribution');
    });
  });

  describe('createAshRgbLayer', () => {
    it('should create ASH RGB layer with specific metadata', () => {
      const mockProduct = {
        name: 'ash_rgb_202601080150',
        path: '/path/to/tiles',
        tile_format: 'webp',
        zoom_levels: [4, 5, 6, 7, 8],
      };

      const layer = service.createAshRgbLayer(mockProduct);

      expect(layer.metadata?.tipo).toBe('ash_rgb');
      expect(layer.metadata?.producto).toBe('Ash RGB Composite');
      expect(layer.metadata?.fecha).toBe('2026-01-08T01:50:00Z');
      expect(layer.attribution).toContain('ASH RGB');
    });
  });

  describe('getAllTileLayers', () => {
    it('should return all available tile layers', (done) => {
      const mockResponse: TileProductsResponse = {
        products: [
          {
            name: 'ash_rgb_202601080150',
            path: '/path/to/tiles',
            tile_format: 'webp',
            zoom_levels: [4, 5, 6, 7, 8],
          },
        ],
        tile_url_template: 'http://localhost:5000/tiles/{product_name}/{z}/{x}/{y}.webp',
      };

      service.getAllTileLayers().subscribe((layers) => {
        expect(layers.length).toBe(1);
        expect(layers[0].metadata?.tipo).toBe('ash_rgb');
        done();
      });

      const req = httpMock.expectOne(apiConfig.getTileProductsUrl());
      req.flush(mockResponse);
    });
  });
});
