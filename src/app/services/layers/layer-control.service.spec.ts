import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LayerControlService } from './layer-control.service';
import { STORAGE_KEYS } from '../../constants';

describe('LayerControlService — SMN stations no-data toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [] });
  });

  it('defaults showStationsWithoutData to true on a fresh load', () => {
    const service = TestBed.inject(LayerControlService);
    expect(service.getSmnStationsShowStationsWithoutData()).toBe(true);
    expect(service.smnStationsShowStationsWithoutData()).toBe(true);
  });

  it('persists the toggle through localStorage so the next session reads it back', () => {
    const service = TestBed.inject(LayerControlService);
    service.setSmnStationsShowStationsWithoutData(false);

    expect(service.getSmnStationsShowStationsWithoutData()).toBe(false);

    // Simulate a page reload: drop the TestBed, instantiate again, and confirm
    // the persisted state survives.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [] });
    const reloaded = TestBed.inject(LayerControlService);
    expect(reloaded.getSmnStationsShowStationsWithoutData()).toBe(false);
  });

  it('keeps the default when localStorage holds a payload missing the field', () => {
    // Older clients persisted the shared-controls blob without
    // `showStationsWithoutData`; loading it must still resolve to the default.
    const legacyBlob = JSON.stringify({
      opacity: 1,
      zIndex: null,
      scaleVisible: false,
      temporalMode: 'latest',
      maxPastHours: 24,
      imageCount: 6,
      selectedTilesetId: null,
    });
    localStorage.setItem(STORAGE_KEYS.SMN_STATIONS_SHARED_CONTROLS, legacyBlob);

    const service = TestBed.inject(LayerControlService);
    expect(service.getSmnStationsShowStationsWithoutData()).toBe(true);
  });

  it('exposes a computed signal that updates when the setter is called', () => {
    const service = TestBed.inject(LayerControlService);
    const initial = service.smnStationsShowStationsWithoutData();
    expect(initial).toBe(true);

    service.setSmnStationsShowStationsWithoutData(false);
    expect(service.smnStationsShowStationsWithoutData()).toBe(false);

    service.setSmnStationsShowStationsWithoutData(true);
    expect(service.smnStationsShowStationsWithoutData()).toBe(true);
  });
});
