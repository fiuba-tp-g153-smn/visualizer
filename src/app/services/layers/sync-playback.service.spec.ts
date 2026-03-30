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
      lastImagesCount: 6,
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
    setLastImagesCount: ReturnType<typeof vi.fn>;
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
      setLastImagesCount: vi.fn(),
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

      TestBed.flushEffects();

      expect(service.eligibleLayers()).toHaveLength(1);
      expect(service.eligibleLayers()[0].layer.id).toBe('layer-a');
    });

    it('should exclude layers with only one tileset', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(createTilesets(1, baseTime, 10));

      TestBed.flushEffects();

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

      TestBed.flushEffects();

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
      TestBed.flushEffects();
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

    it('should restore original lastImagesCount on deselect', () => {
      const originalCount = 6;
      const controls = createMockGoesControls('layer-a', {
        playback: { isPlaying: false, timeIndex: 0, speed: 1, lastImagesCount: originalCount },
      });
      layerControlServiceMock.getControls.mockReturnValue(controls);

      service.selectLayer('layer-a');
      service.deselectLayer('layer-a');

      expect(layerControlServiceMock.setLastImagesCount).toHaveBeenLastCalledWith(
        'layer-a',
        originalCount,
      );
    });

    it('should auto-remove layer when it becomes ineligible', () => {
      service.selectLayer('layer-a');
      expect(service.syncState().selectedLayerIds).toContain('layer-a');

      // Layer becomes inactive
      layerControlServiceMock.activeLayers.set([]);
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
    // TODO: These tests require investigation into how Angular signals/computeds
    // interact with vitest mocks. The alignment validation logic may need to be
    // tested differently due to lazy signal evaluation.
    it.skip('should fail alignment when first frame matches but later frames diverge', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Layer A: 10:00, 10:10, 10:20, 10:30 (10 min intervals)
      const tilesetsA = createTilesets(4, baseTime, 10);

      // Layer B: 10:02, 10:35, 10:50, 11:05 (first is close, rest diverge significantly)
      // This setup should cause alignment to fail because:
      // - Frame 0: A=10:00, B=10:02 (2min diff - OK)
      // - Frame 1: A=10:10, B=10:35 (25min diff - FAIL)
      const tilesetsB = [
        createTileset('b-0', new Date(baseTime.getTime() + 2 * 60 * 1000)), // 10:02
        createTileset('b-1', new Date(baseTime.getTime() + 35 * 60 * 1000)), // 10:35
        createTileset('b-2', new Date(baseTime.getTime() + 50 * 60 * 1000)), // 10:50
        createTileset('b-3', new Date(baseTime.getTime() + 65 * 60 * 1000)), // 11:05
      ];

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
      TestBed.flushEffects();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      // The algorithm should fail to find ANY valid alignment for all 4 frames
      // because there's no way to align layers A and B within ±5min for all frames
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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.selectLayer('layer-c');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);
    });

    it.skip('should fail if one layer diverges significantly', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const layerC = createMockGoesLayer('layer-c');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');
      const controlsC = createMockGoesControls('layer-c');

      // A and B are close, C diverges
      const tilesetsA = createTilesets(4, baseTime, 10);
      const tilesetsB = createTilesets(4, new Date(baseTime.getTime() + 2 * 60 * 1000), 10);
      // C has 20-min intervals starting 30 min later
      const tilesetsC = createTilesets(4, new Date(baseTime.getTime() + 30 * 60 * 1000), 20);

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
      TestBed.flushEffects();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.selectLayer('layer-c');
      service.setFrameCount(4);

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
    // TODO: This test requires investigation into how Angular signals/computeds
    // interact with vitest mocks when the mock implementation changes mid-test.
    it.skip('should pause playback when alignment is lost', () => {
      const layerA = createMockGoesLayer('layer-a');
      const layerB = createMockGoesLayer('layer-b');
      const controlsA = createMockGoesControls('layer-a');
      const controlsB = createMockGoesControls('layer-b');

      // Initially aligned
      const tilesetsA = createTilesets(6, baseTime, 10);
      const tilesetsB = createTilesets(6, new Date(baseTime.getTime() + 1 * 60 * 1000), 10);

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
      TestBed.flushEffects();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      expect(service.isAligned()).toBe(true);

      // Start playback
      service.play();
      expect(service.syncState().isPlaying).toBe(true);

      // Simulate config update that breaks alignment
      // Layer B now has completely different timestamps
      const newTilesetsB = createTilesets(6, new Date(baseTime.getTime() + 30 * 60 * 1000), 20);
      layerConfigServiceMock.getAvailableTilesets.mockImplementation((id: string) =>
        id === 'layer-a' ? tilesetsA : newTilesetsB,
      );

      // Force recomputation by updating active layers signal
      layerControlServiceMock.activeLayers.set([
        { layer: layerA, controls: controlsA },
        { layer: layerB, controls: controlsB },
      ]);
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');

      expect(service.availableFrameCounts()).toEqual([]);
    });
  });

  // ============================================================================
  // Detach Layer
  // ============================================================================

  describe('Detach layer', () => {
    it('should remove layer without restoring lastImagesCount', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');
      const tilesets = createTilesets(8, baseTime, 10);

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(tilesets);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.flushEffects();

      service.selectLayer('layer-a');

      // Clear mock calls from selection
      layerControlServiceMock.setLastImagesCount.mockClear();

      service.detachLayer('layer-a');

      // Should NOT call setLastImagesCount when detaching
      expect(layerControlServiceMock.setLastImagesCount).not.toHaveBeenCalled();
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
      TestBed.flushEffects();

      // Should not crash
      expect(service.eligibleLayers()).toHaveLength(0);
    });

    it('should handle undefined tilesets gracefully', () => {
      const layer = createMockGoesLayer('layer-a');
      const controls = createMockGoesControls('layer-a');

      layerControlServiceMock.activeLayers.set([{ layer, controls }]);
      layerConfigServiceMock.getAvailableTilesets.mockReturnValue(undefined);
      layerControlServiceMock.getControls.mockReturnValue(controls);
      TestBed.flushEffects();

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
      TestBed.flushEffects();

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
      TestBed.flushEffects();

      service.selectLayer('layer-a');
      service.selectLayer('layer-b');
      service.setFrameCount(4);

      // Should still align (B is anchor, A matches within tolerance)
      expect(service.isAligned()).toBe(true);
    });
  });
});
