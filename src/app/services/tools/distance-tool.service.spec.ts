import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { map, type LeafletMouseEvent } from 'leaflet';
import { DistanceToolService } from './distance-tool.service';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';
import { MapContextMenuService } from '../map-context-menu/map-context-menu.service';
import { haversineMeters } from '../../utils/distance.utils';

function contextMenuEvent(lat: number, lng: number): LeafletMouseEvent {
  return {
    latlng: { lat, lng },
    containerPoint: { x: 0, y: 0 },
    originalEvent: { target: document.createElement('div') },
  } as unknown as LeafletMouseEvent;
}

describe('DistanceToolService', () => {
  let service: DistanceToolService;
  let menu: MapContextMenuService;
  let drawing: PolygonDrawingService;

  /** Right-clicks at (lat, lng) and returns the ids of the items offered. */
  function rightClick(lat = 0, lng = 0): string[] {
    menu.handleMapContextMenu(contextMenuEvent(lat, lng));
    return menu.state()?.sections.flatMap((s) => s.items.map(({ id }) => id)) ?? [];
  }

  /** Right-clicks at (lat, lng) and picks `id` from the menu. */
  function choose(id: string, lat = 0, lng = 0): void {
    rightClick(lat, lng);
    const item = menu
      .state()!
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === id);
    expect(item, `menu item ${id}`).toBeDefined();
    menu.run(item!);
  }

  /** Starts measuring from the menu and left-clicks each point. */
  function measure(...points: [number, number][]): void {
    choose('distance-start');
    points.forEach(([lat, lng]) => service.handleMapClick(lat, lng));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DistanceToolService);
    menu = TestBed.inject(MapContextMenuService);
    drawing = TestBed.inject(PolygonDrawingService);
  });

  describe('context menu', () => {
    it('offers to measure when idle', () => {
      expect(rightClick()).toEqual(['distance-start']);
    });

    it('offers only cancelling before the first point', () => {
      measure();

      expect(rightClick()).toEqual(['distance-cancel']);
    });

    it('offers only measurement actions while measuring', () => {
      measure([-34, -58]);

      expect(rightClick()).toEqual(['distance-finish', 'distance-undo', 'distance-clear']);
    });

    it('offers edit, a new measurement or clearing once finished', () => {
      measure([-34, -58], [-31, -64]);
      service.finish();

      expect(rightClick()).toEqual(['distance-edit', 'distance-restart', 'distance-clear']);
    });

    it('stays closed while editing', () => {
      measure([-34, -58], [-31, -64]);
      service.finish();
      service.startEdit();

      menu.handleMapContextMenu(contextMenuEvent(0, 0));

      expect(menu.state()).toBeNull();
    });
  });

  describe('measuring', () => {
    it('enters measuring mode without placing a point', () => {
      choose('distance-start', -20, -60);

      expect(service.mode()).toBe('measuring');
      expect(service.points()).toEqual([]);
    });

    it('places the first point on the next left click', () => {
      measure([-34, -58]);

      expect(service.points()).toEqual([{ lat: -34, lng: -58 }]);
    });

    it('cancels before any point is placed', () => {
      measure();

      choose('distance-cancel');

      expect(service.mode()).toBe('idle');
    });

    it('ignores left clicks until measuring starts', () => {
      expect(service.handleMapClick(-34, -58)).toBe(false);
      expect(service.points()).toEqual([]);
    });

    it('adds a vertex per left click and consumes the click', () => {
      measure([-34, -58]);

      expect(service.handleMapClick(-31, -64)).toBe(true);
      expect(service.points()).toHaveLength(2);
    });

    it('sums the legs into the total', () => {
      measure([-34, -58], [-31, -64], [-33, -69]);

      const [a, b, c] = service.points();
      expect(service.totalMeters()).toBeCloseTo(haversineMeters(a, b) + haversineMeters(b, c), 6);
    });

    it('leaves clicks to polygon drawing and finishes when it starts', () => {
      measure([-34, -58], [-31, -64]);
      drawing.drawingMode.set(DrawingMode.DRAW);
      TestBed.tick();

      expect(service.handleMapClick(-33, -69)).toBe(false);
      expect(service.mode()).toBe('done');
    });

    it('returns clicks to the point query once finished, keeping the path', () => {
      measure([-34, -58], [-31, -64]);

      choose('distance-finish');

      expect(service.mode()).toBe('done');
      expect(service.handleMapClick(-33, -69)).toBe(false);
      expect(service.points()).toHaveLength(2);
    });

    it('discards a path with a single point when finished', () => {
      measure([-34, -58]);

      service.finish();

      expect(service.mode()).toBe('idle');
      expect(service.points()).toEqual([]);
    });

    it('keeps measuring when undo removes every point', () => {
      measure([-34, -58], [-31, -64]);

      choose('distance-undo');
      expect(service.points()).toEqual([{ lat: -34, lng: -58 }]);

      choose('distance-undo');
      expect(service.mode()).toBe('measuring');
      expect(service.points()).toEqual([]);
    });

    it('starts a new measurement from scratch', () => {
      measure([-34, -58], [-31, -64]);
      service.finish();

      choose('distance-restart');

      expect(service.mode()).toBe('measuring');
      expect(service.points()).toEqual([]);
    });

    it('clears everything', () => {
      measure([-34, -58], [-31, -64]);

      choose('distance-clear');

      expect(service.mode()).toBe('idle');
      expect(service.points()).toEqual([]);
    });
  });

  describe('editing', () => {
    beforeEach(() => {
      measure([-34, -58], [-31, -64]);
      service.finish();
      choose('distance-edit');
    });

    it('enters edit mode from a finished measurement and swallows map clicks', () => {
      expect(service.isEditing()).toBe(true);
      expect(service.handleMapClick(-33, -69)).toBe(true);
      expect(service.points()).toHaveLength(2);
    });

    it('keeps the path when saved', () => {
      service.saveEdit();

      expect(service.mode()).toBe('done');
      expect(service.points()).toHaveLength(2);
    });

    it('restores the path from before editing when cancelled', () => {
      const before = service.points();
      service.removeLastPoint();

      service.cancelEdit();

      expect(service.mode()).toBe('done');
      expect(service.points()).toEqual(before);
    });

    it('saves when polygon drawing starts', () => {
      drawing.drawingMode.set(DrawingMode.EDIT);
      TestBed.tick();

      expect(service.mode()).toBe('done');
    });
  });

  describe('teardown', () => {
    const pressEscape = () =>
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    it('stops listening to Esc once the map is gone, keeping the measurement', () => {
      const container = document.createElement('div');
      document.body.append(container);
      const leafletMap = map(container).setView([-34, -58], 4);
      service.initialize(leafletMap);

      measure([-34, -58], [-31, -64]);
      pressEscape();
      expect(service.mode()).toBe('done');

      choose('distance-restart');
      service.handleMapClick(-34, -58);
      service.handleMapClick(-31, -64);
      service.destroy();
      pressEscape();

      expect(service.mode()).toBe('measuring');
      expect(service.points()).toHaveLength(2);
      leafletMap.remove();
      container.remove();
    });

    it('saves an edit in progress', () => {
      measure([-34, -58], [-31, -64]);
      service.finish();
      service.startEdit();

      service.destroy();

      expect(service.mode()).toBe('done');
    });
  });
});
