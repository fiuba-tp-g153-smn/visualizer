import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TileSelectorComponent } from './tile-selector';
import { TileService } from '../../../services/tiles-providers/tile.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('TileSelectorComponent', () => {
  let component: TileSelectorComponent;
  let fixture: ComponentFixture<TileSelectorComponent>;
  let mockTileService: any;

  beforeEach(async () => {
    mockTileService = {
      getAvailableProviders: vi.fn(),
      setProvider: vi.fn(),
      currentProvider: signal({
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }),
    };
    mockTileService.getAvailableProviders.mockReturnValue([
      {
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      },
      {
        id: 'satellite',
        name: 'Satélite',
        url: 'https://example.com/{z}/{x}/{y}.png',
        attribution: '© Esri',
        maxZoom: 18,
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [TileSelectorComponent],
      providers: [{ provide: TileService, useValue: mockTileService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TileSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get available providers', () => {
    expect(component.providers.length).toBe(2);
    expect(mockTileService.getAvailableProviders).toHaveBeenCalled();
  });

  it('should identify active provider', () => {
    expect(component.isActive('osm')).toBe(true);
    expect(component.isActive('satellite')).toBe(false);
  });

  it('should select a provider', () => {
    component.selectProvider('satellite');
    expect(mockTileService.setProvider).toHaveBeenCalledWith('satellite');
  });
});
