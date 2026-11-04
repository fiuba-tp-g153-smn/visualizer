import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { LeafletMouseEvent } from 'leaflet';
import { MapContextMenuService } from './map-context-menu.service';
import { MapContextMenuItem } from './map-context-menu.models';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';

function contextMenuEvent(target?: Element): LeafletMouseEvent {
  return {
    latlng: { lat: -34.6, lng: -58.4 },
    containerPoint: { x: 120.4, y: 80.6 },
    originalEvent: { target: target ?? document.createElement('div') },
  } as unknown as LeafletMouseEvent;
}

const item = (id: string, run: () => void = () => undefined): MapContextMenuItem => ({
  id,
  icon: 'circle',
  label: id,
  run,
});

describe('MapContextMenuService', () => {
  let service: MapContextMenuService;

  const itemIds = (): string[][] =>
    service.state()?.sections.map((section) => section.items.map(({ id }) => id)) ?? [];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapContextMenuService);
  });

  it('stays closed when no section has items', () => {
    service.handleMapContextMenu(contextMenuEvent());

    expect(service.state()).toBeNull();
  });

  it('opens at the clicked point with sections in registration order', () => {
    service.register(200, () => ({ items: [item('late')] }));
    service.register(0, () => ({ items: [item('early')] }));
    service.register(100, () => null);

    service.handleMapContextMenu(contextMenuEvent());

    expect(service.state()).toMatchObject({ x: 120, y: 81 });
    expect(itemIds()).toEqual([['early'], ['late']]);
  });

  it('passes the clicked point to providers', () => {
    const provider = vi.fn(() => null);
    service.register(0, provider);

    service.handleMapContextMenu(contextMenuEvent());

    expect(provider).toHaveBeenCalledWith({ lat: -34.6, lng: -58.4 });
  });

  it('shows only an exclusive section', () => {
    service.register(0, () => ({ items: [item('general')] }));
    service.register(10, () => ({ exclusive: true, items: [item('busy')] }));

    service.handleMapContextMenu(contextMenuEvent());

    expect(itemIds()).toEqual([['busy']]);
  });

  it('stays closed when an exclusive section has no items', () => {
    service.register(0, () => ({ items: [item('general')] }));
    service.register(10, () => ({ exclusive: true, items: [] }));

    service.handleMapContextMenu(contextMenuEvent());

    expect(service.state()).toBeNull();
  });

  it('leaves right clicks over markers and shapes to their own menus', () => {
    service.register(0, () => ({ items: [item('general')] }));
    const shape = document.createElement('div');
    shape.classList.add('leaflet-interactive');

    service.handleMapContextMenu(contextMenuEvent(shape));

    expect(service.state()).toBeNull();
  });

  it('stays closed while drawing polygons', () => {
    service.register(0, () => ({ items: [item('general')] }));
    TestBed.inject(PolygonDrawingService).drawingMode.set(DrawingMode.DRAW);

    service.handleMapContextMenu(contextMenuEvent());

    expect(service.state()).toBeNull();
  });

  it('closes before running the chosen item', () => {
    service.register(0, () => ({ items: [item('general')] }));
    const run = vi.fn(() => expect(service.state()).toBeNull());
    service.handleMapContextMenu(contextMenuEvent());

    service.run(item('x', run));

    expect(run).toHaveBeenCalled();
  });
});
