import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SyncPlaybackService } from './sync-playback.service';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { PlaybackEngineService } from './playback-engine.service';
import { LayerRefreshService } from './layer-refresh.service';
import {
  WeatherStationsTemporalMode,
} from '../../config/layers/weather-stations/controls.constants';
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
  WeatherStationLayer,
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

const stationsLayer = {
  id: 'stations-temperature',
  name: 'Temperatura',
  description: '',
  type: LayerType.VECTOR,
  category: LayerCategory.WEATHER_STATIONS,
  zIndexGroup: ActiveLayerGroupId.POINTS,
  variable: 'temperature',
} as unknown as WeatherStationLayer;

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
    getWeatherStationsTemporalMode: () => WeatherStationsTemporalMode;
    setWeatherStationsTemporalMode: ReturnType<typeof vi.fn>;
    getWeatherStationsSelectedTilesetId: () => string | null;
    setWeatherStationsSelectedTilesetId: ReturnType<typeof vi.fn>;
    isWeatherStationsLayer: (id: string) => boolean;
    getWeatherStationsImageCount: () => number;
    setWeatherStationsImageCount: ReturnType<typeof vi.fn>;
  };
  let stationsImageCount: number;
  let stationsMode: WeatherStationsTemporalMode;
  let stationsTilesetId: string | null;
  let stationTilesetIds: string[];
  let refresh: {
    getWeatherStationsAvailableTilesetIds: () => readonly string[];
    loadWeatherStationsSnapshot: ReturnType<typeof vi.fn>;
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
      getWeatherStationsTemporalMode: () => stationsMode,
      setWeatherStationsTemporalMode: vi.fn((mode: WeatherStationsTemporalMode) => {
        stationsMode = mode;
      }),
      getWeatherStationsSelectedTilesetId: () => stationsTilesetId,
      setWeatherStationsSelectedTilesetId: vi.fn((id: string | null) => {
        stationsTilesetId = id;
      }),
      isWeatherStationsLayer: (id: string) => id === stationsLayer.id,
      getWeatherStationsImageCount: () => stationsImageCount,
      setWeatherStationsImageCount: vi.fn((count: number) => {
        stationsImageCount = count;
        tilesetsRevision.update((v) => v + 1);
      }),
    };
    stationsImageCount = 6;
    stationsMode = WeatherStationsTemporalMode.LATEST;
    stationsTilesetId = null;
    stationTilesetIds = [];
    refresh = {
      getWeatherStationsAvailableTilesetIds: () => {
        tilesetsRevision();
        return stationTilesetIds;
      },
      loadWeatherStationsSnapshot: vi.fn(() => Promise.resolve()),
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
        { provide: LayerRefreshService, useValue: refresh },
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
        'Encendé otra capa del grupo para animarlas juntas',
      );
      expect(layerControl.setImageCount).not.toHaveBeenCalled();
    });

    it('waits for images that have not loaded', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), undefined]);

      expect(statusOf('observations', 'b')).toBe('waiting');
      expect(service.groupHint('observations')).toBe('Cargando imágenes…');
    });

    it('keeps out a layer that matches no instant of the group', () => {
      // a and b every 20': the window is 80'–180'. c sits 10' off its instants, past the
      // tolerance, with nothing before or after the window.
      activate(
        [radarLayer('a'), createTilesets(10, 20)],
        [goesLayer('b'), createTilesets(10, 20)],
        [goesLayer('c'), createTilesets(4, 20, 90)],
      );

      expect(service.enrolledLayerIds('observations')).toEqual(['a', 'b']);
      expect(statusOf('observations', 'c')).toBe('unaligned');
    });

    it('explains when no two layers share an instant', () => {
      activate(
        [radarLayer('a'), createTilesets(10, 20)],
        [goesLayer('b'), createTilesets(4, 20, 90)],
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

    it('combines layers of different cadences at the denser one', () => {
      activate(
        [wrfLayer('wrf'), createTilesets(48, 60)], // hourly
        [wrfLayer('gfs'), createTilesets(16, 180)], // every 3 hours
      );

      expect(service.canPlay('models')).toBe(true);
      const times = [0, 1].map((i) => service.frameTime('models', i)!.getTime());
      expect(times[1] - times[0]).toBe(60 * 60 * 1000);
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
    it('loads just the window for layers of the same cadence', () => {
      activate([radarLayer('a'), createTilesets(10)], [goesLayer('b'), createTilesets(10)]);

      expect(service.frameCount('observations')).toBe(6);
      expect(controlsById.get('a')!.playback.imageCount).toBe(6);
      expect(controlsById.get('b')!.playback.imageCount).toBe(6);
    });

    it('loads fewer images for a layer that is less frequent than the group', () => {
      activate(
        [radarLayer('fast'), createTilesets(30, 5)],
        [goesLayer('slow'), createTilesets(15)],
      );

      // The window is 120'–145': the 10' layer loads 120', 130' and 140'.
      expect(controlsById.get('fast')!.playback.imageCount).toBe(6);
      expect(controlsById.get('slow')!.playback.imageCount).toBe(3);
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

  // ============================================================================
  // Weather stations
  // ============================================================================

  describe('Weather stations', () => {
    /** Hourly snapshots from 10:00 (as ids) around a satellite every 10' from 10:00. */
    function activateWithStations(): void {
      stationTilesetIds = ['20240115T0900Z', '20240115T1000Z', '20240115T1100Z'];
      activate([goesLayer('goes'), createTilesets(12)], [stationsLayer, undefined]);
      service.setFrameCount('observations', 12);
      TestBed.tick();
    }

    const frameAt = (iso: string): number => {
      const time = new Date(iso).getTime();
      const index = service.groupPlan('observations').frames.findIndex((f) => f.time === time);
      expect(index, `frame at ${iso}`).toBeGreaterThanOrEqual(0);
      return index;
    };

    it('sync with a single satellite, which keeps setting the instants', () => {
      activateWithStations();

      expect(service.enrolledLayerIds('observations')).toEqual(['goes', stationsLayer.id]);
      expect(service.canPlay('observations')).toBe(true);
      expect(service.frameTotal('observations')).toBe(12);
    });

    it('join the frame of each hour and hold it until the next one', () => {
      activateWithStations();

      const joined = service
        .groupPlan('observations')
        .frames.filter((f) => f.members.has(stationsLayer.id));
      expect(joined.map((f) => new Date(f.time).toISOString())).toEqual([
        '2024-01-15T10:00:00.000Z',
        '2024-01-15T11:00:00.000Z',
      ]);

      service.setFrameIndex('observations', frameAt('2024-01-15T10:50:00Z'));
      expect(stationsMode).toBe(WeatherStationsTemporalMode.SPECIFIC);
      expect(stationsTilesetId).toBe('20240115T1000Z');

      service.setFrameIndex('observations', frameAt('2024-01-15T11:00:00Z'));
      expect(stationsTilesetId).toBe('20240115T1100Z');
    });

    it('reload only when the hour changes', () => {
      activateWithStations();

      service.setFrameIndex('observations', frameAt('2024-01-15T10:10:00Z'));
      service.setFrameIndex('observations', frameAt('2024-01-15T10:20:00Z'));

      expect(refresh.loadWeatherStationsSnapshot).toHaveBeenCalledTimes(1);
    });

    it('reload a newer hour picked while the previous one still loads', async () => {
      let resolveFirst: () => void = () => undefined;
      refresh.loadWeatherStationsSnapshot
        .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
        .mockImplementation(() => Promise.resolve());
      activateWithStations();

      service.setFrameIndex('observations', frameAt('2024-01-15T10:10:00Z'));
      service.setFrameIndex('observations', frameAt('2024-01-15T11:00:00Z'));
      expect(refresh.loadWeatherStationsSnapshot).toHaveBeenCalledTimes(1);

      resolveFirst();
      await new Promise((resolve) => setTimeout(resolve));

      expect(refresh.loadWeatherStationsSnapshot).toHaveBeenCalledTimes(2);
    });

    it('load back to the hour they show at the window start', () => {
      stationTilesetIds = Array.from(
        { length: 12 },
        (_, h) => `20240115T${String(h).padStart(2, '0')}00Z`,
      );
      activate([goesLayer('goes'), createTilesets(12)], [stationsLayer, undefined]);

      // The window is 11:00–11:50: the stations load 11:00, their last hour.
      expect(stationsImageCount).toBe(1);
    });

    it('settle on their image count', () => {
      activateWithStations();
      const calls = layerControl.setWeatherStationsImageCount.mock.calls.length;

      TestBed.tick();
      TestBed.tick();

      expect(layerControl.setWeatherStationsImageCount).toHaveBeenCalledTimes(calls);
    });

    it('get their own image count back when they leave the group', () => {
      activateWithStations();

      service.setLayerIncluded(stationsLayer.id, false);
      TestBed.tick();

      expect(layerControl.setWeatherStationsImageCount).toHaveBeenLastCalledWith(6);
    });

    it('opt out like any layer', () => {
      activateWithStations();

      service.setLayerIncluded(stationsLayer.id, false);

      expect(statusOf('observations', stationsLayer.id)).toBe('excluded');
      expect(service.canPlay('observations')).toBe(false);
    });
  });
});
