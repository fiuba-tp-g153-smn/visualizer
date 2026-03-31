import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BaseMapSelectorComponent } from './base-map-selector';
import { BaseMapService } from '../../../../services/base-maps/base-map.service';
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
        id: 'argenmap',
        name: 'Argenmap',
        url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
        attribution: 'IGN',
        maxZoom: 21,
      }),
    };
    mockBaseMapService.getAvailableBaseMaps.mockReturnValue([
      {
        id: 'argenmap',
        name: 'Argenmap',
        url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
        attribution: 'IGN',
        maxZoom: 21,
      },
      {
        id: 'satellite',
        name: 'Satélite',
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: '© Esri',
        maxZoom: 17,
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
    expect(component.isActive('argenmap')).toBe(true);
    expect(component.isActive('satellite')).toBe(false);
  });

  it('should select a base map', () => {
    component.selectBaseMap('satellite');
    expect(mockBaseMapService.setBaseMap).toHaveBeenCalledWith('satellite');
  });
});
