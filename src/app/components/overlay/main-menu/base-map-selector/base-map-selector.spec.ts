import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BaseMapSelectorComponent } from './base-map-selector';
import { BaseMapService } from '../../../../services/base-maps/base-map.service';

describe('BaseMapSelectorComponent', () => {
  let component: BaseMapSelectorComponent;
  let fixture: ComponentFixture<BaseMapSelectorComponent>;
  let mockBaseMapService: any;

  const argenmap = {
    id: 'argenmap',
    name: 'Argenmap',
    url: 'https://example.com/basemap/argenmap/{z}/{x}/{y}.png',
    attribution: '<a href="">IGN</a>',
    minZoom: 3,
    maxZoom: 18,
    maxNativeZoom: 21,
    previewZ: 2,
    previewX: 1,
    previewY: 2,
    directUrl: null,
    isTms: false,
  };
  const satellite = {
    id: 'satellite',
    name: 'Satélite',
    url: 'https://example.com/basemap/satellite/{z}/{x}/{y}.png',
    attribution: '© Esri',
    minZoom: 3,
    maxZoom: 18,
    maxNativeZoom: 21,
    previewZ: 2,
    previewX: 1,
    previewY: 2,
    directUrl: null,
    isTms: false,
  };

  beforeEach(async () => {
    mockBaseMapService = {
      providers: signal([argenmap, satellite]),
      currentBaseMap: signal(argenmap),
      loadState: signal<'idle' | 'loading' | 'loaded' | 'error'>('loaded'),
      setBaseMap: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BaseMapSelectorComponent],
      providers: [{ provide: BaseMapService, useValue: mockBaseMapService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BaseMapSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the providers signal from the service', () => {
    expect(component.baseMaps().length).toBe(2);
  });

  it('marks the active base map', () => {
    expect(component.isActive('argenmap')).toBe(true);
    expect(component.isActive('satellite')).toBe(false);
  });

  it('delegates selection to the service', () => {
    component.selectBaseMap('satellite');
    expect(mockBaseMapService.setBaseMap).toHaveBeenCalledWith('satellite');
  });

  it('builds preview URLs from preview coordinates', () => {
    const url = component.getPreviewUrl(argenmap);
    expect(url).toBe('https://example.com/basemap/argenmap/2/1/2.png');
  });
});
