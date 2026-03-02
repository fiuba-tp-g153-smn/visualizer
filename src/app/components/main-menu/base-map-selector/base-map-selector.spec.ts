import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BaseMapSelectorComponent } from './base-map-selector';
import { BaseMapService } from '../../../services/base-maps/base-map.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('BaseMapSelectorComponent', () => {
  let component: BaseMapSelectorComponent;
  let fixture: ComponentFixture<BaseMapSelectorComponent>;
  let mockBaseMapService: any;

  beforeEach(async () => {
    mockBaseMapService = {
      getAvailableBaseMaps: vi.fn(),
      setBaseMap: vi.fn(),
      currentBaseMap: signal({
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }),
    };
    mockBaseMapService.getAvailableBaseMaps.mockReturnValue([
      {
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      },
      {
        id: 'satellite',
        name: 'Satélite (ESRI)',
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: '© Esri',
        maxZoom: 18,
      },
    ]);

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

  it('should get available base maps', () => {
    expect(component.baseMaps.length).toBe(2);
    expect(mockBaseMapService.getAvailableBaseMaps).toHaveBeenCalled();
  });

  it('should identify active base map', () => {
    expect(component.isActive('osm')).toBe(true);
    expect(component.isActive('satellite')).toBe(false);
  });

  it('should select a base map', () => {
    component.selectBaseMap('satellite');
    expect(mockBaseMapService.setBaseMap).toHaveBeenCalledWith('satellite');
  });
});
