import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import type { LeafletMouseEvent } from 'leaflet';
import { MapContextMenuSectionsService } from './map-context-menu-sections.service';
import { MapContextMenuService } from './map-context-menu.service';
import { LayerControlService } from '../layers/layer-control.service';
import { LayerConfigService } from '../layers/layer-config.service';
import { SyncPlaybackService } from '../layers/sync-playback.service';
import { PolygonDrawingService, DrawingMode } from '../polygons/polygon-drawing.service';
import { NotificationService } from '../notifications/notification.service';
import { ActiveLayerEntry, LayerType } from '../../models';

function contextMenuEvent(lat = -34.6037, lng = -58.3816): LeafletMouseEvent {
  return {
    latlng: { lat, lng },
    containerPoint: { x: 0, y: 0 },
    originalEvent: { target: document.createElement('div') },
  } as unknown as LeafletMouseEvent;
}

const tileLayer = (id: string): ActiveLayerEntry =>
  ({ layer: { id, type: LayerType.TILE }, controls: { id } }) as unknown as ActiveLayerEntry;

describe('MapContextMenuSectionsService', () => {
  let menu: MapContextMenuService;
  let activeLayers: ReturnType<typeof signal<ActiveLayerEntry[]>>;
  let playing: Set<string>;
  let layerControl: {
    activeLayers: typeof activeLayers;
    isPlaying: ReturnType<typeof vi.fn>;
    startPlayback: ReturnType<typeof vi.fn>;
    stopPlayback: ReturnType<typeof vi.fn>;
    deactivateLayer: ReturnType<typeof vi.fn>;
  };
  let sync: {
    syncState: ReturnType<typeof signal<{ isPlaying: boolean; selectedLayerIds: string[] }>>;
    isLayerSelected: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

  function open(): string[] {
    menu.handleMapContextMenu(contextMenuEvent());
    return menu.state()?.sections.flatMap((s) => s.items.map(({ id }) => id)) ?? [];
  }

  function choose(id: string): void {
    open();
    const item = menu
      .state()!
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === id);
    expect(item, `menu item ${id}`).toBeDefined();
    menu.run(item!);
  }

  beforeEach(() => {
    activeLayers = signal<ActiveLayerEntry[]>([]);
    playing = new Set();
    layerControl = {
      activeLayers,
      isPlaying: vi.fn((id: string) => playing.has(id)),
      startPlayback: vi.fn((id: string) => playing.add(id)),
      stopPlayback: vi.fn((id: string) => playing.delete(id)),
      deactivateLayer: vi.fn(),
    };
    sync = {
      syncState: signal({ isPlaying: false, selectedLayerIds: [] as string[] }),
      isLayerSelected: vi.fn((id: string) => sync.syncState().selectedLayerIds.includes(id)),
      play: vi.fn(),
      pause: vi.fn(),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
    notifications = { success: vi.fn(), warning: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: LayerControlService, useValue: layerControl },
        {
          provide: LayerConfigService,
          useValue: { getAvailableTilesets: () => [{}, {}, {}] },
        },
        { provide: SyncPlaybackService, useValue: sync },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    TestBed.inject(MapContextMenuSectionsService);
    menu = TestBed.inject(MapContextMenuService);
  });

  it('offers drawing an alert and copying coordinates with no active layers', () => {
    expect(open()).toEqual(['alert-draw', 'copy-coordinates']);
  });

  it('starts drawing an alert', () => {
    choose('alert-draw');

    expect(TestBed.inject(PolygonDrawingService).drawingMode()).toBe(DrawingMode.DRAW);
  });

  it('copies the clicked coordinates', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    choose('copy-coordinates');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('-34.60370, -58.38160');
    expect(notifications.success).toHaveBeenCalled();
  });

  describe('layers', () => {
    beforeEach(() => activeLayers.set([tileLayer('a'), tileLayer('b')]));

    it('offers playing and clearing when nothing plays', () => {
      expect(open()).toEqual(['alert-draw', 'layers-play', 'layers-clear', 'copy-coordinates']);
    });

    it('plays every idle layer', () => {
      choose('layers-play');

      expect(layerControl.startPlayback).toHaveBeenCalledWith('a');
      expect(layerControl.startPlayback).toHaveBeenCalledWith('b');
    });

    it('plays synced layers through the sync timeline', () => {
      sync.syncState.set({ isPlaying: false, selectedLayerIds: ['a'] });

      choose('layers-play');

      expect(sync.play).toHaveBeenCalled();
      expect(layerControl.startPlayback).not.toHaveBeenCalledWith('a');
      expect(layerControl.startPlayback).toHaveBeenCalledWith('b');
    });

    it('offers only pausing once everything plays', () => {
      playing.add('a').add('b');

      expect(open()).toEqual(['alert-draw', 'layers-pause', 'layers-clear', 'copy-coordinates']);
    });

    it('pauses individual and synced playback', () => {
      playing.add('a');

      choose('layers-pause');

      expect(sync.pause).toHaveBeenCalled();
      expect(layerControl.stopPlayback).toHaveBeenCalledWith('a');
    });

    it('removes every active layer after confirming', () => {
      choose('layers-clear');

      expect(dialog.open).toHaveBeenCalled();
      expect(layerControl.deactivateLayer).toHaveBeenCalledWith('a');
      expect(layerControl.deactivateLayer).toHaveBeenCalledWith('b');
    });

    it('keeps the layers when the confirmation is cancelled', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      choose('layers-clear');

      expect(layerControl.deactivateLayer).not.toHaveBeenCalled();
    });
  });
});
