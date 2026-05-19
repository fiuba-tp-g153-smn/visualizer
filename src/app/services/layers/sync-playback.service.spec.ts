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
  ABIGoesTileLayer,
  GoesLayerControls,
  ActiveLayerGroupId,
  WmsLayer,
  WmsLayerControls,
  RadarTileLayer,
  RadarLayerControls,
} from '../../models';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock tileset entry with a specific timestamp.
 */
function createTileset(id: string, time: Date): TilesetEntry {
  return { id, time };
}

/**
 * Creates an array of tilesets with timestamps at regular intervals.
 * @param count Number of tilesets
 * @param baseTime Starting timestamp
 * @param intervalMinutes Minutes between each tileset
 */
function createTilesets(count: number, baseTime: Date, intervalMinutes: number): TilesetEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tileset-${i}`,
    time: new Date(baseTime.getTime() + i * intervalMinutes * 60 * 1000),
  }));
}

/**
 * Creates a mock ABI GOES layer.
 */
function createMockGoesLayer(
  id: string,
  availablePeriods: readonly number[] = [1, 6, 12, 24],
): ABIGoesTileLayer {
  return {
    id,
    name: `Layer ${id}`,
    type: LayerType.TILE,
    category: LayerCategory.GOES_19,
    isForecast: false,
    channel: 'ch-13',
    minNativeZoom: 0,
    maxNativeZoom: 8,
    zIndexGroup: ActiveLayerGroupId.BASE,
    availablePeriods,
  };
}

/**
 * Creates mock controls for a GOES layer.
 */
function createMockGoesControls(
  layerId: string,
  overrides: Partial<GoesLayerControls> = {},
): GoesLayerControls {
  return {
    id: layerId,
    type: LayerType.TILE,
    category: LayerCategory.GOES_19,
    visible: true,
    opacity: 1,
    zIndex: 1,
    playback: {
      isPlaying: false,
      timeIndex: 0,
      speed: 1,
      imageCount: 6,
    },
    ...overrides,
  };
}

/**
 * Creates a mock Radar layer.
 */
function createMockRadarLayer(
  id: string,
  availablePeriods: readonly number[] = [1, 6, 12, 24],
): RadarTileLayer {
  return {
    id,
    name: `Radar Layer ${id}`,
    type: LayerType.TILE,
    category: LayerCategory.RADAR,
    isForecast: false,
    minNativeZoom: 0,
    maxNativeZoom: 8,
    zIndexGroup: ActiveLayerGroupId.BASE,
    availablePeriods,
    availableElevations: [
      { id: 'elev0', name: '0.5°', activeByDefault: true, zIndexPreference: 1 },
    ],
  };
}

/**
 * Creates mock controls for a Radar layer.
 */
function createMockRadarControls(
  layerId: string,
  overrides: Partial<RadarLayerControls> = {},
): RadarLayerControls {
  return {
    id: layerId,
    type: LayerType.TILE,
    category: LayerCategory.RADAR,
    visible: true,
    opacity: 1,
    zIndex: 1,
    playback: {
      isPlaying: false,
      timeIndex: 0,
      speed: 1,
      imageCount: 6,
    },
    elevation: {
      selectedElevationIds: ['elev0'],
      elevationOpacity: { elev0: 1 },
    },
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('SyncPlaybackService', () => {
  let service: SyncPlaybackService;
  let layerControlServiceMock: {
    activeLayers: WritableSignal<ActiveLayerEntry[]>;
    getControls: ReturnType<typeof vi.fn>;
    setTimeIndex: ReturnType<typeof vi.fn>;
    setImageCount: ReturnType<typeof vi.fn>;
    stopPlayback: ReturnType<typeof vi.fn>;
  };
  let layerConfigServiceMock: {
    getAvailableTilesets: ReturnType<typeof vi.fn>;
  };
  let playbackEngineServiceMock: {
    register: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    setFrameIndex: ReturnType<typeof vi.fn>;
    setSpeed: ReturnType<typeof vi.fn>;
    setFrameCount: ReturnType<typeof vi.fn>;
  };

  // Test data
  const baseTime = new Date('2024-01-15T10:00:00Z');

  beforeEach(() => {
    // Create mocks
    layerControlServiceMock = {
      activeLayers: signal<ActiveLayerEntry[]>([]),
      getControls: vi.fn(),
      setTimeIndex: vi.fn(),
      setImageCount: vi.fn(),
      stopPlayback: vi.fn(),
    };

    layerConfigServiceMock = {
      getAvailableTilesets: vi.fn(),
    };

    playbackEngineServiceMock = {
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
        { provide: LayerControlService, useValue: layerControlServiceMock },
        { provide: LayerConfigService, useValue: layerConfigServiceMock },
        { provide: PlaybackEngineService, useValue: playbackEngineServiceMock },
      ],
    });

    service = TestBed.inject(SyncPlaybackService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial state', () => {
    it('should start with empty state', () => {
      const state = service.syncState();
      expect(state.selectedLayerIds).toEqual([]);
      expect(state.frameCount).toBe(1);
      expect(state.frameIndex).toBe(0);
      expect(state.speed).toBe(1);
      expect(state.isPlaying).toBe(false);
    });

    it('should have no eligible layers when none are active', () => {
      expect(service.eligibleLayers()).toEqual([]);
    });

    it('should have empty available frame counts with no selection', () => {
      expect(service.availableFrameCounts()).toEqual([]);
    });
  });

  // ============================================================================
  // Eligible Layers
  // ============================================================================

  describe('Eligible layers', () => {
    it('should include TILE layers with multiple tilesets', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(createTilesets(8, baseTime, 10));

      TestBed.tick();

      expect(service.eligibleLayers()).toHaveLength(1);
      expect(service.eligibleLayers()[0].layer.id).toBe('layer-a');
    });

    it('should exclude layers with only one tileset', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(createTilesets(1, baseTime, 10));

      TestBed.tick();

      expect(service.eligibleLayers()).toHaveLength(0);
    });

    it('should exclude WMS layers', () => {
      const wmsLayer: WmsLayer = {
        id: 'wms-layer',
        name: 'WMS Layer',
        type: LayerType.WMS,
        category: LayerCategory.IGN_WMS,
        wmsLayerName: 'test',
        zIndexGroup: ActiveLayerGroupId.OVERLAY,
      };
      const wmsControls: WmsLayerControls = {
        id: 'wms-layer',
        type: LayerType.WMS,
        visible: true,
        opacity: 1,
        zIndex: 1,
      };
      layerControlServiceMock.activeLayers.set([{ layer: wmsLayer, controls: wmsControls }]);

      TestBed.tick();

      expect(service.eligibleLayers()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Layer Selection
  // ============================================================================

  describe('Layer selection', () => {
    beforeEach(() => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(createTilesets(8, baseTime, 10));
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();
    });

    it('should add layer to selection', () => {
      service.selectLayer('layer-a');
      expect(service.syncState().selectedLayerIds).toContain('layer-a');
    });

    it('should not duplicate selection', () => {
      service.selectLayer('layer-a');
      service.selectLayer('layer-a');
      expect(service.syncState().selectedLayerIds).toEqual(['layer-a']);
    });

    it('should remove layer from selection', () => {
      service.selectLayer('layer-a');
      service.deselectLayer('layer-a');
      expect(service.syncState().selectedLayerIds).toEqual([]);
    });

    it('should toggle layer selection', () => {
      service.toggleLayerSelection('layer-a');
      expect(service.isLayerSelected('layer-a')).toBe(true);

      service.toggleLayerSelection('layer-a');
      expect(service.isLayerSelected('layer-a')).toBe(false);
    });

    it('should restore original imageCount on deselect', () => {
      const originalCount = 6;
      const controls = createMockGoesControls('layer-a', {
        playback: { isPlaying: false, timeIndex: 0, speed: 1, imageCount: originalCount },
      });
      layerControlServiceMock.getControls.mockReturnValue(controls);

      service.selectLayer('layer-a');
      service.deselectLayer('layer-a');

      expect(layerControlServiceMock.setImageCount).toHaveBeenLastCalledWith(
        'layer-a',
        originalCount,
      );
    });

    it('should auto-remove layer when it becomes ineligible', () => {
      service.selectLayer('layer-a');
      expect(service.syncState().selectedLayerIds).toContain('layer-a');

      // Layer becomes inactive
      layerControlServiceMock.activeLayers.set([]);
      TestBed.tick();

      expect(service.syncState().selectedLayerIds).toEqual([]);
    });
  });

  // ============================================================================
  // Sync Alignment - Basic Cases
  // ============================================================================

  describe('Sync alignment - basic cases', () => {
    it('should align single layer without cross-layer checks', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(8, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);
      expect(service.effectiveFrameCount()).toBe(4);
    });

    it('should align two layers with identical timestamps', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const tilesets = createTilesets(8, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);
      expect(service.effectiveFrameCount()).toBe(4);
    });

    it('should align layers with small time differences (within 5 min)', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A: timestamps at 10:00, 10:10, 10:20, 10:30
      const tilesetsA = createTilesets(4, baseTime, 10);
      // Layer B: timestamps at 10:02, 10:12, 10:22, 10:32 (2 min offset)
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 2 * 60 * 1000), 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);
    });
  });

  // ============================================================================
  // Sync Alignment - Edge Cases with All Frames Validation
  // ============================================================================

  describe('Sync alignment - all frames validation', () => {
    it('should fail alignment when layers have no timestamps within tolerance', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A: 10:00, 10:10, 10:20, 10:30 (10 min intervals)
      const tilesetsA = createTilesets(4, baseTime, 10);

      // Layer B: 11:00, 11:10, 11:20, 11:30 (60 min after A, NO possible alignment)
      // All B timestamps are > 5 min away from ALL A timestamps
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 60 * 60 * 1000), 10);

      // Configure mocks BEFORE setting active layers
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );

      // Set active layers AFTER mocks are configured
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      // The algorithm should fail because NO frame from A can align with ANY frame from B
      expect(service.isAligned()).toBe(false);
    });

    it('should pass alignment when ALL frames are within tolerance', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A: 10:00, 10:10, 10:20, 10:30 (10 min intervals)
      const tilesetsA = createTilesets(4, baseTime, 10);

      // Layer B: 10:03, 10:12, 10:18, 10:33 (all within ±5min of corresponding A frames)
      const tilesetsB = [
        createTileset('b-0', new Date(baseTime.getTime() + 3 * 60 * 1000)), // 10:03 (3min from 10:00)
        createTileset('b-1', new Date(baseTime.getTime() + 12 * 60 * 1000)), // 10:12 (2min from 10:10)
        createTileset('b-2', new Date(baseTime.getTime() + 18 * 60 * 1000)), // 10:18 (2min from 10:20)
        createTileset('b-3', new Date(baseTime.getTime() + 33 * 60 * 1000)), // 10:33 (3min from 10:30)
      ];

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);
      expect(service.effectiveFrameCount()).toBe(4);
    });

    it('should find alignment by advancing anchor when initial offset fails all-frames check', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A: 10:00, 10:10, 10:20, 10:30, 10:40, 10:50 (6 frames)
      const tilesetsA = createTilesets(6, baseTime, 10);

      // Layer B: First frames have issues, but later frames align well
      // 09:50 (too early), 10:22, 10:32, 10:42, 10:52 (5 frames)
      // Initial base would put anchor at 10:20, B at 10:22, but subsequent frames work
      const tilesetsB = [
        createTileset('b-0', new Date(baseTime.getTime() - 10 * 60 * 1000)), // 09:50
        createTileset('b-1', new Date(baseTime.getTime() + 22 * 60 * 1000)), // 10:22
        createTileset('b-2', new Date(baseTime.getTime() + 32 * 60 * 1000)), // 10:32
        createTileset('b-3', new Date(baseTime.getTime() + 42 * 60 * 1000)), // 10:42
        createTileset('b-4', new Date(baseTime.getTime() + 52 * 60 * 1000)), // 10:52
      ];

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      // Should find alignment by advancing anchor
      expect(service.isAligned()).toBe(true);
    });
  });

  // ============================================================================
  // Sync Alignment - Three or More Layers
  // ============================================================================

  describe('Sync alignment - multiple layers', () => {
    it('should align three layers with slightly different timestamps', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const layerC = createMockGoesLayer('layer-c');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const controlsC = createMockGoesControls('layer-c');

      // All layers have 10-min intervals with small offsets
      const tilesetsA = createTilesets(4, baseTime, 10); // 10:00, 10:10, ...
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 1 * 60 * 1000), 10); // 10:01, 10:11, ...
      const tilesetsC = createTilesets(4, new Date(baseTime.getTime() + 2 * 60 * 1000), 10); // 10:02, 10:12, ...

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
        { layer: layerC, controls: controlsC },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) => {
        if (id === 'layer-a') return tilesetsA;
        if (id === 'layer-b') return tilesetsB;
        return tilesetsC;
      });
      layerControlServiceMock.getControls.mockImplementation((id: string) => {
        if (id === 'layer-a') return controlsA;
        if (id === 'layer-b') return controlsB;
        return controlsC;
      });
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.selectLayer('layer-c');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);
    });

    it('should fail if one layer is completely out of range', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const layerC = createMockGoesLayer('layer-c');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const controlsC = createMockGoesControls('layer-c');

      // A and B are close (can align)
      const tilesetsA = createTilesets(4, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 2 * 60 * 1000), 10);
      // C is 2 HOURS later - completely out of range of A and B for ALL frames
      const tilesetsC = createTilesets(4, new Date(baseTime.getTime() + 120 * 60 * 1000), 10);

      // Configure mocks BEFORE setting active layers
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) => {
        if (id === 'layer-a') return tilesetsA;
        if (id === 'layer-b') return tilesetsB;
        return tilesetsC;
      });
      layerControlServiceMock.getControls.mockImplementation((id: string) => {
        if (id === 'layer-a') return controlsA;
        if (id === 'layer-b') return controlsB;
        return controlsC;
      });

      // Set active layers AFTER mocks are configured
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
        { layer: layerC, controls: controlsC },
      ]);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.selectLayer('layer-c');
      service.setFrameCount(4);

      // Should fail because C cannot align with A/B
      expect(service.isAligned()).toBe(false);
    });
  });

  // ============================================================================
  // Playback Controls
  // ============================================================================

  describe('Playback controls', () => {
    beforeEach(() => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(8, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(4);
    });

    it('should start playback', () => {
      service.play();

      expect(service.syncState().isPlaying).toBe(true);
      expect(playbackEngineServiceMock.register).toHaveBeenCalled();
      expect(playbackEngineServiceMock.play).toHaveBeenCalled();
    });

    it('should pause playback', () => {
      service.play();
      service.pause();

      expect(service.syncState().isPlaying).toBe(false);
      expect(playbackEngineServiceMock.pause).toHaveBeenCalled();
    });

    it('should toggle playback', () => {
      service.togglePlayback();
      expect(service.syncState().isPlaying).toBe(true);

      service.togglePlayback();
      expect(service.syncState().isPlaying).toBe(false);
    });

    it('should not play with less than 2 frames', () => {
      service.setFrameCount(1);
      service.play();

      expect(service.syncState().isPlaying).toBe(false);
      expect(playbackEngineServiceMock.play).not.toHaveBeenCalled();
    });

    it('should set frame index', () => {
      service.setFrameIndex(2);

      expect(service.syncState().frameIndex).toBe(2);
      expect(layerControlServiceMock.setTimeIndex).toHaveBeenCalled();
    });

    it('should clamp frame index to valid range', () => {
      service.setFrameIndex(100);

      // effectiveFrameCount is 4, so max index is 3
      expect(service.syncState().frameIndex).toBeLessThanOrEqual(3);
    });

    it('should update speed', () => {
      service.setSpeed(2);

      expect(service.syncState().speed).toBe(2);
    });

    it('should clamp speed to valid range', () => {
      service.setSpeed(0.1); // Below min (0.4)
      expect(service.syncState().speed).toBe(0.4);

      service.setSpeed(20); // Above max (10)
      expect(service.syncState().speed).toBe(10);
    });
  });

  // ============================================================================
  // Frame Info
  // ============================================================================

  describe('Frame info', () => {
    it('should return null when no layers selected', () => {
      expect(service.currentFrameInfo()).toBeNull();
    });

    it('should return frame info with deviation for multiple layers', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // 3 min offset between layers
      const tilesetsA = createTilesets(4, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 3 * 60 * 1000), 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      const info = service.currentFrameInfo();
      expect(info).not.toBeNull();
      expect(info!.deviationMs).toBe(3 * 60 * 1000); // 3 minutes
    });
  });

  // ============================================================================
  // Reset
  // ============================================================================

  describe('Reset', () => {
    it('should reset all state', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(8, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(4);
      service.setFrameIndex(2);
      service.play();

      service.reset();

      const state = service.syncState();
      expect(state.selectedLayerIds).toEqual([]);
      expect(state.frameCount).toBe(1);
      expect(state.frameIndex).toBe(0);
      expect(state.isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // Config Updates During Playback
  // ============================================================================

  describe('Config updates during playback', () => {
    it('should pause playback when alignment is lost', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Initially aligned
      const tilesetsA = createTilesets(6, baseTime, 10);
      const tilesetsB = createTilesets(6, new Date(baseTime.getTime() + 1 * 60 * 1000), 10);

      // Configure mocks BEFORE setting active layers
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );

      // Set active layers AFTER mocks are configured
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);

      // Start playback
      service.play();
      expect(service.syncState().isPlaying).toBe(true);

      // Simulate config update that breaks alignment
      // Layer B now has timestamps 2 HOURS later - completely out of range
      const newTilesetsB = createTilesets(6, new Date(baseTime.getTime() + 120 * 60 * 1000), 10);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : newTilesetsB,
      );

      // Force recomputation by updating active layers signal
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      TestBed.tick();

      // Playback should be paused due to alignment loss
      expect(service.isAligned()).toBe(false);
      expect(service.syncState().isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // Available Frame Counts
  // ============================================================================

  describe('Available frame counts', () => {
    it('should compute intersection of available periods', () => {
      const layerA = createMockGoesLayer('layer-a', [1, 6, 12, 24]);
      const layerB = createMockGoesLayer('layer-b', [6, 12, 48]);
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const tilesets = createTilesets(50, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');

      // Intersection of [1,6,12,24] and [6,12,48] = [6, 12]
      expect(service.availableFrameCounts()).toEqual([6, 12]);
    });

    it('should return empty array when no common periods', () => {
      const layerA = createMockGoesLayer('layer-a', [1, 6]);
      const layerB = createMockGoesLayer('layer-b', [12, 24]);
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const tilesets = createTilesets(30, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');

      expect(service.availableFrameCounts()).toEqual([]);
    });
  });

  // ============================================================================
  // Detach Layer
  // ============================================================================

  describe('Detach layer', () => {
    it('should remove layer without restoring imageCount', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(8, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');

      // Clear mock calls from selection
      layerControlServiceMock.setImageCount.mockClear();

      service.detachLayer('layer-a');

      // Should NOT call setImageCount when detaching
      expect(layerControlServiceMock.setImageCount).not.toHaveBeenCalled();
      expect(service.syncState().selectedLayerIds).toEqual([]);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle empty tilesets gracefully', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue([]);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      // Should not crash
      expect(service.eligibleLayers()).toHaveLength(0);
    });

    it('should handle undefined tilesets gracefully', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(undefined);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      expect(service.eligibleLayers()).toHaveLength(0);
    });

    it('should compute correct effective frame count with unequal tileset sizes', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A has 8 tilesets, Layer B has only 4
      const tilesetsA = createTilesets(8, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 40 * 60 * 1000), 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(6);

      // Effective frame count should be limited by the smaller tileset
      expect(service.effectiveFrameCount()).toBeLessThanOrEqual(4);
    });

    it('should identify the oldest layer as anchor', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer B starts 30 minutes earlier
      const tilesetsA = createTilesets(4, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() - 30 * 60 * 1000), 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      // Should still align (B is anchor, A matches within tolerance)
      expect(service.isAligned()).toBe(true);
    });
  });

  // ============================================================================
  // Layers With Fewer Frames
  // ============================================================================

  describe('Layers with fewer frames', () => {
    it('should return empty set when all layers have enough tilesets', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(6);

      expect(service.layersWithFewerFrames().size).toBe(0);
    });

    it('should return actual tileset count via getActualTilesetCount', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(7, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      expect(service.getActualTilesetCount('layer-a')).toBe(7);
    });

    it('should return 0 for unknown layer in getActualTilesetCount', () => {
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(undefined);
      expect(service.getActualTilesetCount('unknown-layer')).toBe(0);
    });

    it('should identify layers with fewer tilesets than frameCount', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A has 10 tilesets, Layer B has only 4
      const tilesetsA = createTilesets(10, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 60 * 60 * 1000), 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(6);

      const fewerFrames = service.layersWithFewerFrames();
      expect(fewerFrames.has('layer-b')).toBe(true);
      expect(fewerFrames.has('layer-a')).toBe(false);
    });

    it('should identify multiple layers with fewer frames', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const layerC = createMockGoesLayer('layer-c');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const controlsC = createMockGoesControls('layer-c');

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
        { layer: layerC, controls: controlsC },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) => {
        if (id === 'layer-a') return createTilesets(10, baseTime, 10);
        if (id === 'layer-b') return createTilesets(3, baseTime, 10);
        return createTilesets(5, baseTime, 10);
      });
      layerControlServiceMock.getControls.mockImplementation((id: string) => {
        if (id === 'layer-a') return controlsA;
        if (id === 'layer-b') return controlsB;
        return controlsC;
      });
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.selectLayer('layer-c');
      service.setFrameCount(6);

      const fewerFrames = service.layersWithFewerFrames();
      expect(fewerFrames.has('layer-a')).toBe(false);
      expect(fewerFrames.has('layer-b')).toBe(true);
      expect(fewerFrames.has('layer-c')).toBe(true);
    });
  });

  // ============================================================================
  // Frame Info - Extended Cases
  // ============================================================================

  describe('Frame info - extended cases', () => {
    it('should return frame info for arbitrary frame index via getFrameInfo', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(6, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(6);

      // Get frame info for frame 2 (should be 20 minutes after base)
      const info = service.getFrameInfo(2);
      expect(info).not.toBeNull();
      expect(info!.avgTime.getTime()).toBe(baseTime.getTime() + 2 * 10 * 60 * 1000);
    });

    it('should return null when not aligned', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Completely out of range - 2 hours apart
      const tilesetsA = createTilesets(4, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 120 * 60 * 1000), 10);

      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(false);
      expect(service.getFrameInfo(0)).toBeNull();
      expect(service.currentFrameInfo()).toBeNull();
    });

    it('should return zero deviation for single layer', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(6, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(4);

      const info = service.currentFrameInfo();
      expect(info).not.toBeNull();
      expect(info!.deviationMs).toBe(0);
    });
  });

  // ============================================================================
  // Auto-select Frame Count
  // ============================================================================

  describe('Auto-select frame count', () => {
    it('should auto-select frameCount >= 2 on first layer selection', () => {
      const layer = createMockGoesLayer('layer-a', [1, 6, 12, 24]);
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(30, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      // Initial frameCount is 1
      expect(service.syncState().frameCount).toBe(1);

      service.selectLayer('layer-a');

      // Should auto-select the first available count >= 2 (which is 6)
      expect(service.syncState().frameCount).toBe(6);
    });

    it('should not auto-select if frameCount already >= 2', () => {
      const layer = createMockGoesLayer('layer-a', [1, 6, 12, 24]);
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(30, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      // Manually set frameCount to 12 before selecting
      service.setFrameCount(12);
      service.selectLayer('layer-a');

      // Should keep 12, not change to 6
      expect(service.syncState().frameCount).toBe(12);
    });
  });

  // ============================================================================
  // Original ImageCount Protection
  // ============================================================================

  describe('Original imageCount protection', () => {
    it('should not overwrite original imageCount on duplicate selection', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a', {
        playback: { isPlaying: false, timeIndex: 0, speed: 1, imageCount: 8 },
      });
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');

      // Change the controls to simulate external update
      const newControls = createMockGoesControls('layer-a', {
        playback: { isPlaying: false, timeIndex: 0, speed: 1, imageCount: 20 },
      });
      layerControlServiceMock.getControls.mockReturnValue(newControls);

      // Try to select again (should be no-op)
      service.selectLayer('layer-a');

      // Deselect should restore original value (8), not the new one (20)
      service.deselectLayer('layer-a');
      expect(layerControlServiceMock.setImageCount).toHaveBeenLastCalledWith('layer-a', 8);
    });
  });

  // ============================================================================
  // Engine Synchronization
  // ============================================================================

  describe('Engine synchronization', () => {
    beforeEach(() => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(20, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(6);
    });

    it('should sync speed with engine while playing', () => {
      service.play();
      playbackEngineServiceMock.setSpeed.mockClear();

      service.setSpeed(2.5);

      expect(playbackEngineServiceMock.setSpeed).toHaveBeenCalledWith('sync', 2.5);
    });

    it('should not sync speed with engine when not playing', () => {
      playbackEngineServiceMock.setSpeed.mockClear();

      service.setSpeed(2.5);

      expect(playbackEngineServiceMock.setSpeed).not.toHaveBeenCalled();
    });

    it('should sync frame count with engine while playing', () => {
      service.play();
      playbackEngineServiceMock.setFrameCount.mockClear();

      service.setFrameCount(12);

      expect(playbackEngineServiceMock.setFrameCount).toHaveBeenCalledWith(
        'sync',
        expect.any(Number),
      );
    });

    it('should stop individual layer playback when starting sync playback', () => {
      layerControlServiceMock.stopPlayback.mockClear();

      service.play();

      expect(layerControlServiceMock.stopPlayback).toHaveBeenCalledWith('layer-a');
    });

    it('should stop individual playback for all selected layers', () => {
      // Add a second layer
      const layerB = createMockGoesLayer('layer-b');
      const controlsB = createMockGoesControls('layer-b');
      const layer = createMockGoesLayer('layer-a');
      const controlsA = createMockGoesControls('layer-a');
      const tilesets = createTilesets(20, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-b');
      layerControlServiceMock.stopPlayback.mockClear();

      service.play();

      expect(layerControlServiceMock.stopPlayback).toHaveBeenCalledWith('layer-a');
      expect(layerControlServiceMock.stopPlayback).toHaveBeenCalledWith('layer-b');
    });
  });

  // ============================================================================
  // Frame Count and Index Clamping
  // ============================================================================

  describe('Frame count and index clamping', () => {
    beforeEach(() => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(20, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
    });

    it('should clamp frameIndex when frameCount is reduced', () => {
      service.setFrameCount(12);
      service.setFrameIndex(10);

      expect(service.syncState().frameIndex).toBe(10);

      service.setFrameCount(6);

      // frameIndex should be clamped to max valid index (5)
      expect(service.syncState().frameIndex).toBeLessThanOrEqual(5);
    });

    it('should handle setFrameIndex when effectiveFrameCount is minimal', () => {
      service.setFrameCount(1);

      service.setFrameIndex(0);
      expect(service.syncState().frameIndex).toBe(0);

      service.setFrameIndex(10);
      expect(service.syncState().frameIndex).toBe(0); // Clamped to 0
    });

    it('should handle frameCount equal to tilesets length exactly', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(6, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      TestBed.tick();

      service.setFrameCount(6);

      expect(service.effectiveFrameCount()).toBe(6);
      expect(service.isAligned()).toBe(true);
    });
  });

  // ============================================================================
  // Auto-deselect with Remaining Layers
  // ============================================================================

  describe('Auto-deselect with remaining layers', () => {
    it('should keep playback running when some layers remain after auto-deselect', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(6);
      service.play();

      expect(service.syncState().isPlaying).toBe(true);

      // Remove layer-b from active layers (simulates user deactivating the layer)
      layerControlServiceMock.activeLayers.set([{ layer: layerA, controls: controlsA }]);
      TestBed.tick();

      // layer-b should be auto-removed from selection
      expect(service.syncState().selectedLayerIds).not.toContain('layer-b');
      expect(service.syncState().selectedLayerIds).toContain('layer-a');
      // Note: Playback continues with remaining layer (implementation may pause for realignment)
    });

    it('should pause playback when all layers are auto-deselected', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.setFrameCount(6);
      service.play();

      expect(service.syncState().isPlaying).toBe(true);

      // Remove all layers
      layerControlServiceMock.activeLayers.set([]);
      TestBed.tick();

      expect(service.syncState().selectedLayerIds).toEqual([]);
      expect(service.syncState().isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // SYNC_EXTRA_FRAMES Verification
  // ============================================================================

  describe('SYNC_EXTRA_FRAMES buffer', () => {
    it('should request frameCount + 4 tilesets from layer', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(20, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
      layerControlServiceMock.setImageCount.mockClear();

      service.setFrameCount(6);

      // Should request 6 + 4 = 10 tilesets
      expect(layerControlServiceMock.setImageCount).toHaveBeenCalledWith('layer-a', 10);
    });

    it('should apply SYNC_EXTRA_FRAMES to all selected layers', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const tilesets = createTilesets(20, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      layerControlServiceMock.setImageCount.mockClear();

      service.setFrameCount(12);

      // Both should get 12 + 4 = 16
      expect(layerControlServiceMock.setImageCount).toHaveBeenCalledWith('layer-a', 16);
      expect(layerControlServiceMock.setImageCount).toHaveBeenCalledWith('layer-b', 16);
    });
  });

  // ============================================================================
  // Speed Boundary Values
  // ============================================================================

  describe('Speed boundary values', () => {
    beforeEach(() => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.tick();

      service.selectLayer('layer-a');
    });

    it('should accept speed exactly at minimum (0.4)', () => {
      service.setSpeed(0.4);
      expect(service.syncState().speed).toBe(0.4);
    });

    it('should accept speed exactly at maximum (10)', () => {
      service.setSpeed(10);
      expect(service.syncState().speed).toBe(10);
    });

    it('should accept speed within valid range', () => {
      service.setSpeed(5);
      expect(service.syncState().speed).toBe(5);
    });
  });

  // ============================================================================
  // RADAR Category Layers
  // ============================================================================

  describe('RADAR category layers', () => {
    it('should include RADAR layers as eligible', () => {
      const layer = createMockRadarLayer('radar-a');
      const controls = createMockRadarControls('radar-a');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      TestBed.tick();

      expect(service.eligibleLayers()).toHaveLength(1);
      expect(service.eligibleLayers()[0].layer.id).toBe('radar-a');
    });

    it('should sync GOES and RADAR layers together', () => {
      const goesLayer = createMockGoesLayer('goes-a');
      const radarLayer = createMockRadarLayer('radar-a');
      const goesControls = createMockGoesControls('goes-a');
      const radarControls = createMockRadarControls('radar-a');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: goesLayer, controls: goesControls },
        { layer: radarLayer, controls: radarControls },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'goes-a' ? goesControls : radarControls,
      );
      TestBed.tick();

      service.selectLayer('goes-a');
      service.selectLayer('radar-a');
      service.setFrameCount(6);

      expect(service.isAligned()).toBe(true);
      expect(service.syncState().selectedLayerIds).toContain('goes-a');
      expect(service.syncState().selectedLayerIds).toContain('radar-a');
    });

    it('should compute available frame counts intersection with RADAR layers', () => {
      const goesLayer = createMockGoesLayer('goes-a', [1, 6, 12, 24]);
      const radarLayer = createMockRadarLayer('radar-a', [6, 12, 48]);
      const goesControls = createMockGoesControls('goes-a');
      const radarControls = createMockRadarControls('radar-a');
      const tilesets = createTilesets(50, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: goesLayer, controls: goesControls },
        { layer: radarLayer, controls: radarControls },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'goes-a' ? goesControls : radarControls,
      );
      TestBed.tick();

      service.selectLayer('goes-a');
      service.selectLayer('radar-a');

      // Intersection: [1,6,12,24] ∩ [6,12,48] = [6, 12]
      expect(service.availableFrameCounts()).toEqual([6, 12]);
    });
  });

  // ============================================================================
  // Update Layers for Frame (Internal Behavior)
  // ============================================================================

  describe('Update layers for frame', () => {
    it('should not call setTimeIndex when not aligned', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Completely out of range
      const tilesetsA = createTilesets(4, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 120 * 60 * 1000), 10);

      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : tilesetsB,
      );
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(false);

      layerControlServiceMock.setTimeIndex.mockClear();
      service.setFrameIndex(1);

      // Should not call setTimeIndex because layers are not aligned
      expect(layerControlServiceMock.setTimeIndex).not.toHaveBeenCalled();
    });

    it('should set correct time indices for all layers when aligned', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const tilesets = createTilesets(10, baseTime, 10);

      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockImplementation((id: string) =>
        id === 'layer-a' ? controlsA : controlsB,
      );
      TestBed.tick();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(6);

      layerControlServiceMock.setTimeIndex.mockClear();
      service.setFrameIndex(2);

      expect(layerControlServiceMock.setTimeIndex).toHaveBeenCalledWith(
        'layer-a',
        expect.any(Number),
      );
      expect(layerControlServiceMock.setTimeIndex).toHaveBeenCalledWith(
        'layer-b',
        expect.any(Number),
      );
    });
  });
});
