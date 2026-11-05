import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SyncPlaybackService } from './sync-playback.service';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { PlaybackEngineService } from './playback-engine.service';
import {
  LayerType,
  LayerCategory,
  TilesetEntry,
  ActiveLayerEntry,
  ActiveLayerGroupId,
  ABIGoesTileLayer,
  ForecastModelTileLayer,
  LayerControls,
  RadarTileLayer,
  TileLayerControls,
  WmsLayer,
} from '../../models';

// ============================================================================
// Test Utilities
// ============================================================================

const baseTime = new Date('2024-01-15T10:00:00Z');

function createTilesets(
  count: number,
  intervalMinutes = 10,
  offsetMinutes = 0,
  start: Date = baseTime,
): TilesetEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tileset-${i}`,
    time: new Date(start.getTime() + (offsetMinutes + i * intervalMinutes) * 60 * 1000),
  }));
}

function goesLayer(
  id: string,
  availablePeriods: readonly number[] = [6, 12, 24],
): ABIGoesTileLayer {
  return {
    id,
    name: `GOES ${id}`,
    type: LayerType.TILE,
    category: LayerCategory.GOES_19,
    isForecast: false,
    channel: 'c13',
    minNativeZoom: 0,
    maxNativeZoom: 8,
    zIndexGroup: ActiveLayerGroupId.BASE,
    availablePeriods,
  };
}

function radarLayer(id: string, availablePeriods: readonly number[] = [6, 12]): RadarTileLayer {
  return {
    id,
    name: `Radar ${id}`,
    type: LayerType.TILE,
    category: LayerCategory.RADAR,
    isForecast: false,
    minNativeZoom: 0,
    maxNativeZoom: 8,
    zIndexGroup: ActiveLayerGroupId.BASE,
    availablePeriods,
    availableElevations: [],
  };
}

function wrfLayer(
  id: string,
  availablePeriods: readonly number[] = [6, 12, 24],
): ForecastModelTileLayer {
  return {
    id,
    name: `WRF ${id}`,
    type: LayerType.TILE,
    category: LayerCategory.WRF,
    isForecast: true,
    productId: id,
    minNativeZoom: 0,
    maxNativeZoom: 8,
    zIndexGroup: ActiveLayerGroupId.BASE,
    availablePeriods,
  };
}

const wmsLayer: WmsLayer = {
  id: 'wms',
  name: 'WMS',
  type: LayerType.WMS,
  category: LayerCategory.IGN_WMS,
  wmsLayerName: 'test',
  zIndexGroup: ActiveLayerGroupId.OVERLAY,
};

function tileControls(id: string, zIndex: number, imageCount = 6): TileLayerControls {
  return {
    id,
    type: LayerType.TILE,
    visible: true,
    opacity: 1,
    zIndex,
    playback: { isPlaying: false, timeIndex: 0, speed: 1, imageCount },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('SyncPlaybackService', () => {
  let service: SyncPlaybackService;
  let activeLayers: WritableSignal<ActiveLayerEntry[]>;
  let controlsById: Map<string, TileLayerControls>;
  let tilesetsById: Map<string, TilesetEntry[]>;
  /** Tilesets reach the service through signals in the app; bumped on every activate(). */
  let tilesetsRevision: WritableSignal<number>;
  let layerControl: {
    activeLayers: WritableSignal<ActiveLayerEntry[]>;
    getControls: ReturnType<typeof vi.fn>;
    setTimeIndex: ReturnType<typeof vi.fn>;
    setImageCount: ReturnType<typeof vi.fn>;
    stopPlayback: ReturnType<typeof vi.fn>;
  };
  let engine: {
    register: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    setFrameIndex: ReturnType<typeof vi.fn>;
    setSpeed: ReturnType<typeof vi.fn>;
    setFrameCount: ReturnType<typeof vi.fn>;
  };

  /** Activates layers; z-order follows array order (first = topmost). */
  function activate(...entries: [ActiveLayerEntry['layer'], TilesetEntry[] | undefined][]): void {
    controlsById.clear();
    tilesetsRevision.update((v) => v + 1);
    activeLayers.set(
      entries.map(([layer, tilesets], i) => {
        if (tilesets) tilesetsById.set(layer.id, tilesets);
        const controls = tileControls(layer.id, entries.length - i);
        controlsById.set(layer.id, controls);
        return { layer, controls: controls as LayerControls };
      }),
    );
    TestBed.tick();
  }

  beforeEach(() => {
    activeLayers = signal<ActiveLayerEntry[]>([]);
    controlsById = new Map();
    tilesetsById = new Map();
    tilesetsRevision = signal(0);
    layerControl = {
      activeLayers,
      getControls: vi.fn((id: string) => controlsById.get(id)),
      setTimeIndex: vi.fn(),
      setImageCount: vi.fn((id: string, count: number) => {
        const controls = controlsById.get(id);
        if (controls) controls.playback.imageCount = count;
      }),
      stopPlayback: vi.fn(),
    };
    engine = {
      register: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      setFrameIndex: vi.fn(),
      setSpeed: vi.fn(),
      setFrameCount: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SyncPlaybackService,
        { provide: LayerControlService, useValue: layerControl },
        {
          provide: LayerConfigService,
          useValue: {
            getAvailableTilesets: (id: string) => {
              tilesetsRevision();
              return tilesetsById.get(id);
            },
          },
        },
        { provide: PlaybackEngineService, useValue: engine },
      ],
    });

    service = TestBed.inject(SyncPlaybackService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const statusOf = (groupId: 'observations' | 'models', layerId: string) =>
    service.groupLayers(groupId).find(({ layer }) => layer.id === layerId)?.status;

  // ============================================================================
  // Grouping
  // ============================================================================

  describe('Grouping', () => {
    it('has no active groups when no layers are active', () => {
      expect(service.activeGroupIds()).toEqual([]);
    });

    it('puts radar and satellite in observations and models in their own group', () => {
      activate(
        [radarLayer('radar'), createTilesets(10)],
        [goesLayer('goes'), createTilesets(10)],
        [wrfLayer('wrf'), createTilesets(10, 60)],
      );

      expect(service.activeGroupIds()).toEqual(['observations', 'models']);
      expect(service.groupLayers('observations').map(({ layer }) => layer.id)).toEqual([
        'radar',
        'goes',
      ]);
    });

    it('ignores non-tile layers', () => {
      activeLayers.set([
        {
          layer: wmsLayer,
          controls: { id: 'wms', type: LayerType.WMS, visible: true, opacity: 1, zIndex: 1 },
        },
      ]);
      TestBed.tick();

      expect(service.activeGroupIds()).toEqual([]);
    });
  });

  // ============================================================================
  // Enrollment
  // ============================================================================

  describe('Enrollment', () => {
    it('enrolls compatible layers without any manual selection', () => {
      activate([radarLayer('radar'), createTilesets(10)], [goesLayer('goes'), createTilesets(10)]);

      expect(service.enrolledLayerIds('observations')).toEqual(['radar', 'goes']);
      expect(service.isLayerSelected('radar')).toBe(true);
      expect(service.canPlay('observations')).toBe(true);
    });

    it('leaves a lone layer with its own controls and says what to turn on', () => {
      activate([radarLayer('radar'), createTilesets(10)]);

      expect(statusOf('observations', 'radar')).toBe('waiting');
      expect(service.isLayerSelected('radar')).toBe(false);
      expect(service.groupHint('observations')).toBe(
        'Encendé otro radar o satélite para animarlos juntos',
      );
      expect(layerControl.setImageCount).not.toHaveBeenCalled();
    });

    it('waits for images that have not loaded', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), undefined]);

      expect(statusOf('observations', 'b')).toBe('waiting');
      expect(service.groupHint('observations')).toBe('Cargando imágenes…');
    });

    it('keeps out a layer that matches no instant of the group', () => {
      activate(
        [radarLayer('a'), createTilesets(10)],
        [goesLayer('b'), createTilesets(10)],
        [goesLayer('c'), createTilesets(10, 10, 300)],
      );

      expect(service.enrolledLayerIds('observations')).toEqual(['a', 'b']);
      expect(statusOf('observations', 'c')).toBe('unaligned');
    });

    it('explains when no two layers share an instant', () => {
      activate(
        [radarLayer('a'), createTilesets(10)],
        [goesLayer('b'), createTilesets(10, 10, 300)],
      );

      expect(service.canPlay('observations')).toBe(false);
      expect(service.groupHint('observations')).toBe('Las capas no tienen horarios en común');
    });

    it('keeps an instant one layer is missing, that layer holding its image', () => {
      const gappy = createTilesets(10).filter((_, i) => i !== 7);
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), gappy]);

      // window: the last 6 of a (indices 4–9); b has no image for index 7
      expect(service.frameTotal('observations')).toBe(6);
      expect(service.enrolledLayerIds('observations')).toEqual(['a', 'b']);
    });

    it('combines layers of different cadences at the sparser one', () => {
      activate(
        [wrfLayer('wrf'), createTilesets(48, 60)], // hourly
        [wrfLayer('gfs'), createTilesets(16, 180)], // every 3 hours
      );

      expect(service.canPlay('models')).toBe(true);
      const times = [0, 1].map((i) => service.frameTime('models', i)!.getTime());
      expect(times[1] - times[0]).toBe(180 * 60 * 1000);
    });

    it('re-enrolls a previously excluded layer when it is enabled again', () => {
      const entries: [RadarTileLayer | ABIGoesTileLayer, TilesetEntry[]][] = [
        [radarLayer('a'), createTilesets(10)],
        [goesLayer('b'), createTilesets(10)],
      ];
      activate(...entries);
      service.setLayerIncluded('b', false);
      TestBed.tick();

      activate(entries[0]);
      activate(...entries);

      expect(service.enrolledLayerIds('observations')).toEqual(['a', 'b']);
    });
  });

  // ============================================================================
  // Image count
  // ============================================================================

  describe('Image count', () => {
    it('loads the window plus a margin for layers of the same cadence', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), createTilesets(10)]);

      expect(service.frameCount('observations')).toBe(6);
      expect(controlsById.get('a')!.playback.imageCount).toBe(8);
      expect(controlsById.get('b')!.playback.imageCount).toBe(8);
    });

    it('loads more images for a layer that is more frequent than the group', () => {
      activate(
        [radarLayer('fast'), createTilesets(30, 5)],
        [goesLayer('slow'), createTilesets(10)],
      );

      // 6 frames every 10' span 50': the 5' layer needs 11 images, plus the margin
      expect(controlsById.get('fast')!.playback.imageCount).toBe(13);
      expect(controlsById.get('slow')!.playback.imageCount).toBe(8);
    });

    it('restores the original count when the user unchecks a layer', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), createTilesets(10)]);

      service.setLayerIncluded('b', false);
      TestBed.tick();

      expect(statusOf('observations', 'b')).toBe('excluded');
      expect(controlsById.get('b')!.playback.imageCount).toBe(6);
    });

    it('keeps the current count when a layer is detached from its own controls', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), createTilesets(10)]);
      layerControl.setImageCount.mockClear();

      service.detachLayer('b');
      TestBed.tick();

      expect(statusOf('observations', 'b')).toBe('excluded');
      expect(layerControl.setImageCount).not.toHaveBeenCalledWith('b', 6);
    });
  });

  // ============================================================================
  // Playback
  // ============================================================================

  describe('Playback', () => {
    beforeEach(() => {
      activate(
        [radarLayer('a'), createTilesets(10)],
        [goesLayer('b'), createTilesets(10)],
        [wrfLayer('w1'), createTilesets(48, 60)],
        [wrfLayer('w2'), createTilesets(48, 60)],
      );
    });

    it('plays a group on its own engine session', () => {
      service.play('observations');

      expect(service.groupState('observations').isPlaying).toBe(true);
      expect(engine.register).toHaveBeenCalledWith('sync:observations', 6, 1);
      expect(layerControl.stopPlayback).toHaveBeenCalledWith('a');
    });

    it('takes over a layer only while its group plays', () => {
      expect(service.isLayerSelected('a')).toBe(true);
      expect(service.isLayerSyncing('a')).toBe(false);
      expect(service.syncingLayerCount()).toBe(0);

      service.play('observations');

      expect(service.isLayerSyncing('a')).toBe(true);
      expect(service.isLayerSyncing('w1')).toBe(false);
      expect(service.syncingLayerCount()).toBe(2);
    });

    it('plays groups independently', () => {
      service.play('observations');
      service.play('models');
      service.pause('observations');

      expect(service.groupState('models').isPlaying).toBe(true);
      expect(service.isAnyPlaying()).toBe(true);
    });

    it('drives each enrolled layer to the tileset of the frame', () => {
      service.setFrameIndex('observations', 2);

      // last 6 of 10 tilesets start at index 4
      expect(layerControl.setTimeIndex).toHaveBeenCalledWith('a', 6);
      expect(layerControl.setTimeIndex).toHaveBeenCalledWith('b', 6);
      expect(layerControl.setTimeIndex).not.toHaveBeenCalledWith('w1', expect.anything());
    });

    it('pauses when the group can no longer sync', () => {
      service.play('observations');
      activate([radarLayer('a'), createTilesets(10)]);

      expect(service.groupState('observations').isPlaying).toBe(false);
    });

    it('clamps speed', () => {
      service.setSpeed('observations', 0.01);
      expect(service.groupState('observations').speed).toBe(0.1);
      service.setSpeed('observations', 20);
      expect(service.groupState('observations').speed).toBe(10);
    });
  });

  // ============================================================================
  // Joining a playing group
  // ============================================================================

  describe('Frames drawn by hand', () => {
    it('keeps every layer in the group when all frames are deleted', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), createTilesets(10)]);

      service.setFrames('observations', []);
      TestBed.tick();

      expect(service.enrolledLayerIds('observations')).toEqual(['a', 'b']);
      expect(service.frameTotal('observations')).toBe(0);
      expect(service.groupTimelines('observations')).toHaveLength(2);
      expect(service.groupHint('observations')).toBe(
        'Uní al menos dos cuadros en la línea de tiempo',
      );
    });

    it('plays the drawn frames and goes back to the automatic ones on reset', () => {
      const tilesets = createTilesets(10);
      activate([radarLayer('a'), tilesets], [goesLayer('b'), createTilesets(10)]);
      const [first, second] = tilesets.map((t) => t.time.getTime());

      service.setFrames('observations', [{ a: first }, { a: second, b: first }]);
      TestBed.tick();
      expect(service.frameTotal('observations')).toBe(2);
      expect(service.frameSpecs('observations')).toEqual([{ a: first }, { a: second, b: first }]);

      service.resetCustomization('observations');
      TestBed.tick();
      expect(service.frameTotal('observations')).toBe(6);
    });
  });

  describe('Joining a playing group', () => {
    const observations = (...extra: [RadarTileLayer | ABIGoesTileLayer, TilesetEntry[]][]) =>
      activate(
        [radarLayer('a'), createTilesets(10)],
        [goesLayer('b'), createTilesets(10)],
        ...extra,
      );

    it('does not start a group by itself', () => {
      activate([radarLayer('a'), createTilesets(10)]);
      observations();

      expect(service.canPlay('observations')).toBe(true);
      expect(service.groupState('observations').isPlaying).toBe(false);
    });

    it('folds a layer that joins a playing group into the animation', () => {
      observations();
      service.play('observations');
      layerControl.setTimeIndex.mockClear();

      observations([goesLayer('c'), createTilesets(10)]);

      expect(service.groupState('observations').isPlaying).toBe(true);
      expect(service.enrolledLayerIds('observations')).toContain('c');
      expect(layerControl.stopPlayback).toHaveBeenCalledWith('c');
      expect(layerControl.setTimeIndex).toHaveBeenCalledWith('c', expect.any(Number));
    });

    it('leaves a paused group paused when a layer joins', () => {
      observations();

      observations([goesLayer('c'), createTilesets(10)]);

      expect(service.groupState('observations').isPlaying).toBe(false);
      expect(layerControl.stopPlayback).not.toHaveBeenCalledWith('c');
    });
  });
});
