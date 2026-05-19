import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { LayerType, TilesetEntry, FrameInfo, SyncState } from '../../models';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { PlaybackEngineService } from './playback-engine.service';
import { formatDurationMs, formatDateTimeOnly } from '../../utils/tileset-timestamp';
import { computeWindowStart } from '../../utils/playback-window';

const SYNC_ENGINE_ID = 'sync';

interface SyncAlignment {
  readonly baseIndices: ReadonlyMap<string, number>;
  readonly effectiveFrameCount: number;
  /** False when anchor exhausted all offsets without finding ±5 min matches for all layers. */
  readonly isAligned: boolean;
}

/**
 * Manages frame-based synchronized playback for multiple tile layers.
 *
 * Alignment: anchor = layer whose first-window frame is oldest; other layers search their
 * full tileset history for a match within ±ALIGN_TOLERANCE_MS. If any fail, advance anchor
 * base +1 and retry. Exhausting the anchor → isAligned: false (sync blocked).
 *
 * Layers are requested to load frameCount + SYNC_EXTRA_FRAMES tilesets so that anchor
 * advancement never reduces the effective frame count below N.
 *
 * Uses PlaybackEngineService for the timer, shared with individual-layer playback.
 */
@Injectable({ providedIn: 'root' })
export class SyncPlaybackService {
  private readonly layerControlService = inject(LayerControlService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly engineService = inject(PlaybackEngineService);

  private readonly originalImageCount = new Map<string, number>();

  private readonly state = signal<SyncState>({
    selectedLayerIds: [],
    frameCount: 1,
    frameIndex: 0,
    speed: 1,
    isPlaying: false,
  });

  readonly syncState = this.state.asReadonly();

  constructor() {
    effect(() => {
      const eligibleIds = new Set(this.eligibleLayers().map((item) => item.layer.id));
      const selectedIds = this.state().selectedLayerIds;
      const invalidIds = selectedIds.filter((id) => !eligibleIds.has(id));

      if (invalidIds.length > 0) {
        invalidIds.forEach((id) => this.restoreOriginalImageCount(id));
        this.state.update((s) => ({
          ...s,
          selectedLayerIds: s.selectedLayerIds.filter((id) => eligibleIds.has(id)),
        }));
        if (this.state().selectedLayerIds.length === 0) {
          this.pause();
        }
      }
    });

    // Stop playback when alignment is lost due to a config change (e.g. new tilesets arrive
    // and the ±5 min constraint can no longer be satisfied).
    effect(() => {
      if (!this.isAligned() && this.state().isPlaying) {
        this.pause();
      }
    });
  }

  // ============================================================================
  // Derived state
  // ============================================================================

  readonly eligibleLayers = computed(() => {
    return this.layerControlService
      .activeLayers()
      .filter(({ layer }) => {
        if (layer.type !== LayerType.TILE) return false;
        const tilesets = this.layerConfigService.getAvailableTilesets(layer.id);
        return tilesets && tilesets.length > 1;
      })
      .map(({ layer, controls }) => ({ layer, controls }))
      .sort((a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0));
  });

  /**
   * Intersection of availablePeriods across all currently selected layers.
   * These are the valid N values the user can choose from in the UI.
   */
  readonly availableFrameCounts = computed((): readonly number[] => {
    const selectedIds = this.state().selectedLayerIds;
    if (selectedIds.length === 0) return [];

    const periodSets = selectedIds.map((id) => {
      const layer = this.eligibleLayers().find((item) => item.layer.id === id)?.layer;
      if (!layer || layer.type !== LayerType.TILE) return null;
      const periods = layer.availablePeriods;
      if (!periods || periods.length === 0) return null;
      return new Set(periods);
    });

    if (periodSets.some((s) => s === null)) return [];

    const [first, ...rest] = periodSets as ReadonlySet<number>[];
    const intersection = [...first].filter((v) => rest.every((s) => s.has(v)));
    return intersection.sort((a, b) => a - b);
  });

  /** Maximum allowed time difference between aligned frames across layers. */
  private readonly ALIGN_TOLERANCE_MS = 5 * 60 * 1000;

  /**
   * Extra tilesets requested per layer beyond frameCount so the anchor-advance algorithm
   * always has enough history to produce N aligned frames even when layers are offset.
   */
  private readonly SYNC_EXTRA_FRAMES = 4;

  /**
   * Computes the aligned base index for the start of the N-frame playback window per layer.
   *
   * Strategy:
   *  1. Initial baseIndex[id] = max(0, tilesets.length - N) per layer.
   *  2. Anchor = layer whose tilesets[baseIndex] is the oldest timestamp.
   *  3. For each non-anchor layer find the closest tileset within ±5 min of anchor's first frame.
   *  4. Verify ALL subsequent frames (0 to effectiveFrameCount-1) are also within ±5 min across layers.
   *  5. If any frame fails alignment → advance anchor base by 1 and retry.
   *  6. If anchor exhausts all frames → isAligned: false (sync blocked, no fallback).
   */
  private readonly syncAlignment = computed((): SyncAlignment => {
    const { selectedLayerIds, frameCount: N } = this.state();
    const EMPTY: SyncAlignment = {
      baseIndices: new Map(),
      effectiveFrameCount: 0,
      isAligned: true,
    };

    if (selectedLayerIds.length === 0) return EMPTY;

    // Build per-layer data: tilesets already have pre-parsed timestamps.
    type LayerEntry = {
      tilesets: TilesetEntry[];
      timestamps: number[];
      isForecast: boolean;
    };
    const layerData = new Map<string, LayerEntry>();

    for (const layerId of selectedLayerIds) {
      const tilesets = this.layerConfigService.getAvailableTilesets(layerId);
      const layer = this.eligibleLayers().find((item) => item.layer.id === layerId)?.layer;
      if (!tilesets?.length || !layer || layer.type !== LayerType.TILE) continue;
      layerData.set(layerId, {
        tilesets,
        timestamps: tilesets.map((e) => e.time.getTime()),
        isForecast: layer.isForecast,
      });
    }

    if (layerData.size === 0) return EMPTY;

    // Initial base indices: first N for forecasts, last N for historical.
    const initialBase = new Map<string, number>();
    for (const [id, { tilesets, isForecast }] of layerData) {
      initialBase.set(id, computeWindowStart(tilesets.length, N, isForecast));
    }

    // Single layer: no cross-layer alignment needed.
    if (layerData.size === 1) {
      return {
        baseIndices: initialBase,
        effectiveFrameCount: this.computeEfc(layerData, initialBase, N),
        isAligned: true,
      };
    }

    // Find anchor: layer with the oldest first-frame timestamp in its initial window.
    let anchorId: string | null = null;
    let anchorOldestMs = Infinity;
    for (const [id, { timestamps }] of layerData) {
      const ms = timestamps[initialBase.get(id)!];
      if (ms != null && ms < anchorOldestMs) {
        anchorOldestMs = ms;
        anchorId = id;
      }
    }

    if (!anchorId) {
      // No parseable timestamps: treat as aligned with initial bases.
      return {
        baseIndices: initialBase,
        effectiveFrameCount: this.computeEfc(layerData, initialBase, N),
        isAligned: true,
      };
    }

    const anchor = layerData.get(anchorId)!;
    const anchorBaseStart = initialBase.get(anchorId)!;

    // Try advancing anchor's base until all non-anchor layers find a match within ±5 min
    // for ALL frames in the window.
    for (let offset = 0; anchorBaseStart + offset < anchor.tilesets.length; offset++) {
      const anchorBase = anchorBaseStart + offset;
      const anchorFirstMs = anchor.timestamps[anchorBase];
      if (anchorFirstMs == null) continue;

      const candidate = new Map<string, number>([[anchorId, anchorBase]]);
      let firstFrameMatched = true;

      // Step 1: Find best match for first frame (frame 0)
      for (const [id, { timestamps }] of layerData) {
        if (id === anchorId) continue;
        let bestIdx = -1;
        let bestDiff = Infinity;
        for (let i = 0; i < timestamps.length; i++) {
          const diff = Math.abs(timestamps[i] - anchorFirstMs);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }
        if (bestIdx === -1 || bestDiff > this.ALIGN_TOLERANCE_MS) {
          firstFrameMatched = false;
          break;
        }
        candidate.set(id, bestIdx);
      }

      if (!firstFrameMatched) continue;

      // Step 2: Verify ALL subsequent frames are also within ±5 min across layers
      const efc = this.computeEfc(layerData, candidate, N);
      const allFramesAligned = this.verifyAllFramesAligned(layerData, candidate, efc);

      if (allFramesAligned) {
        return { baseIndices: candidate, effectiveFrameCount: efc, isAligned: true };
      }
    }

    // Anchor exhausted: alignment failed, block sync.
    return { baseIndices: new Map(), effectiveFrameCount: 0, isAligned: false };
  });

  /**
   * Verifies that all frames (0 to frameCount-1) are within ±ALIGN_TOLERANCE_MS across all layers.
   * For each frame index, computes the max timestamp spread and checks it's within tolerance.
   */
  private verifyAllFramesAligned(
    layerData: ReadonlyMap<
      string,
      { readonly tilesets: readonly TilesetEntry[]; readonly timestamps: readonly number[] }
    >,
    baseIndices: ReadonlyMap<string, number>,
    frameCount: number,
  ): boolean {
    for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
      const timestamps: number[] = [];

      for (const [id, { timestamps: ts, tilesets }] of layerData) {
        const baseIdx = baseIndices.get(id)!;
        const idx = Math.min(baseIdx + frameIdx, tilesets.length - 1);
        timestamps.push(ts[idx]);
      }

      if (timestamps.length < 2) continue;

      const minTs = Math.min(...timestamps);
      const maxTs = Math.max(...timestamps);
      const spread = maxTs - minTs;

      if (spread > this.ALIGN_TOLERANCE_MS) {
        return false;
      }
    }

    return true;
  }

  readonly effectiveFrameCount = computed(() => this.syncAlignment().effectiveFrameCount);
  readonly isAligned = computed(() => this.syncAlignment().isAligned);

  /**
   * Whether any selected layer currently has fewer available tilesets than frameCount.
   * The slider handles this gracefully (clamps to available count), but the UI
   * can show a warning badge next to the affected layers.
   */
  readonly layersWithFewerFrames = computed((): ReadonlySet<string> => {
    const { selectedLayerIds, frameCount } = this.state();
    const short = new Set<string>();
    for (const id of selectedLayerIds) {
      const tilesets = this.layerConfigService.getAvailableTilesets(id);
      if ((tilesets?.length ?? 0) < frameCount) short.add(id);
    }
    return short;
  });

  /**
   * Returns the actual available tileset count for a given layer.
   * Useful for UI to show "6 → 3" when a layer has fewer frames than requested.
   */
  getActualTilesetCount(layerId: string): number {
    const tilesets = this.layerConfigService.getAvailableTilesets(layerId);
    return tilesets?.length ?? 0;
  }

  /**
   * Frame info (avg time ± deviation) at the current frame index.
   */
  readonly currentFrameInfo = computed((): FrameInfo | null => {
    return this.getFrameInfo(this.state().frameIndex);
  });

  // ============================================================================
  // Public queries
  // ============================================================================

  isLayerSelected(layerId: string): boolean {
    return this.state().selectedLayerIds.includes(layerId);
  }

  /**
   * Returns the avg time ± max deviation for a given frame index across all selected layers.
   */
  getFrameInfo(frameIndex: number): FrameInfo | null {
    const { selectedLayerIds } = this.state();
    const { baseIndices, effectiveFrameCount: efc, isAligned } = this.syncAlignment();
    if (selectedLayerIds.length === 0 || !isAligned) return null;

    const timestamps: Date[] = [];

    for (const layerId of selectedLayerIds) {
      const tilesets = this.layerConfigService.getAvailableTilesets(layerId);
      if (!tilesets?.length) continue;
      const layer = this.eligibleLayers().find((item) => item.layer.id === layerId)?.layer;
      const isForecast = layer?.type === LayerType.TILE && layer.isForecast;
      const baseIdx =
        baseIndices.get(layerId) ?? computeWindowStart(tilesets.length, efc, isForecast);
      timestamps.push(tilesets[Math.min(baseIdx + frameIndex, tilesets.length - 1)].time);
    }

    if (timestamps.length === 0) return null;

    const times = timestamps.map((d) => d.getTime());
    const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
    const deviationMs = Math.max(...times) - Math.min(...times);
    const avgDate = new Date(avgMs);

    const deviation = deviationMs > 0 ? ` ± ${formatDurationMs(deviationMs)}` : '';
    const label = formatDateTimeOnly(avgDate) + deviation;

    return { avgTime: avgDate, deviationMs, label };
  }

  // ============================================================================
  // Public actions — layer selection
  // ============================================================================

  toggleLayerSelection(layerId: string): void {
    if (this.isLayerSelected(layerId)) {
      this.deselectLayer(layerId);
    } else {
      this.selectLayer(layerId);
    }
  }

  selectLayer(layerId: string): void {
    if (this.isLayerSelected(layerId)) return;
    this.saveOriginalImageCount(layerId);
    this.state.update((s) => ({ ...s, selectedLayerIds: [...s.selectedLayerIds, layerId] }));
    this.applyImageCountToLayer(layerId);

    // Auto-select a playable frameCount when the default (1) is not usable
    if (this.state().frameCount < 2) {
      const counts = this.availableFrameCounts();
      const defaultCount = counts.find((n) => n >= 2);
      if (defaultCount !== undefined) this.setFrameCount(defaultCount);
    }
  }

  /**
   * Removes a layer from sync and restores its original imageCount.
   * Also called by LayerItemComponent when the user "detaches" via individual controls.
   */
  deselectLayer(layerId: string): void {
    if (!this.isLayerSelected(layerId)) return;
    this.restoreOriginalImageCount(layerId);
    this.state.update((s) => ({
      ...s,
      selectedLayerIds: s.selectedLayerIds.filter((id) => id !== layerId),
    }));
    if (this.state().selectedLayerIds.length === 0) {
      this.pause();
    }
  }

  /**
   * Detaches a layer from sync without restoring the original imageCount.
   * Used when the user interacts manually (e.g. moves the slider, press play) so
   * the current sync values are preserved for individual playback.
   */
  detachLayer(layerId: string): void {
    if (!this.isLayerSelected(layerId)) return;
    this.originalImageCount.delete(layerId); // discard — keep current state
    this.state.update((s) => ({
      ...s,
      selectedLayerIds: s.selectedLayerIds.filter((id) => id !== layerId),
    }));
    if (this.state().selectedLayerIds.length === 0) {
      this.pause();
    }
  }

  // ============================================================================
  // Public actions — playback control
  // ============================================================================

  setFrameCount(frameCount: number): void {
    this.state.update((s) => ({
      ...s,
      frameCount,
      frameIndex: Math.min(s.frameIndex, Math.max(0, frameCount - 1)),
    }));
    this.state().selectedLayerIds.forEach((id) => this.applyImageCountToLayer(id));
    if (this.state().isPlaying) {
      const newEfc = this.syncAlignment().effectiveFrameCount;
      this.engineService.setFrameCount(SYNC_ENGINE_ID, newEfc);
    }
  }

  setFrameIndex(frameIndex: number): void {
    const efc = this.syncAlignment().effectiveFrameCount;
    const clamped = Math.max(0, Math.min(frameIndex, Math.max(0, efc - 1)));
    this.state.update((s) => ({ ...s, frameIndex: clamped }));
    this.updateLayersForFrame(clamped);
  }

  setSpeed(speed: number): void {
    const clamped = Math.max(0.4, Math.min(10, speed));
    this.state.update((s) => ({ ...s, speed: clamped }));
    if (this.state().isPlaying) {
      this.engineService.setSpeed(SYNC_ENGINE_ID, clamped);
    }
  }

  togglePlayback(): void {
    if (this.state().isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    const { selectedLayerIds, frameIndex, speed } = this.state();
    const { effectiveFrameCount: efc, isAligned } = this.syncAlignment();
    if (selectedLayerIds.length === 0 || !isAligned || efc < 2) return;

    selectedLayerIds.forEach((id) => this.layerControlService.stopPlayback(id));

    this.engineService.register(SYNC_ENGINE_ID, efc, speed);
    this.engineService.setFrameIndex(SYNC_ENGINE_ID, Math.min(frameIndex, efc - 1));

    this.state.update((s) => ({ ...s, isPlaying: true }));

    this.engineService.play(SYNC_ENGINE_ID, (fi) => {
      this.state.update((s) => ({ ...s, frameIndex: fi }));
      this.updateLayersForFrame(fi);
    });
  }

  pause(): void {
    this.engineService.pause(SYNC_ENGINE_ID);
    this.state.update((s) => ({ ...s, isPlaying: false }));
  }

  reset(): void {
    this.pause();
    this.state().selectedLayerIds.forEach((id) => this.restoreOriginalImageCount(id));
    this.state.set({
      selectedLayerIds: [],
      frameCount: 1,
      frameIndex: 0,
      speed: 1,
      isPlaying: false,
    });
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Sets each selected layer's timeIndex using pre-aligned base indices from {@link syncAlignment}.
   */
  private updateLayersForFrame(frameIndex: number): void {
    const { selectedLayerIds } = this.state();
    const { baseIndices, isAligned } = this.syncAlignment();
    if (!isAligned) return;

    for (const layerId of selectedLayerIds) {
      const tilesets = this.layerConfigService.getAvailableTilesets(layerId);
      if (!tilesets?.length) continue;
      const baseIdx = baseIndices.get(layerId)!;
      this.layerControlService.setTimeIndex(
        layerId,
        Math.min(baseIdx + frameIndex, tilesets.length - 1),
      );
    }
  }

  private applyImageCountToLayer(layerId: string): void {
    this.layerControlService.setImageCount(
      layerId,
      this.state().frameCount + this.SYNC_EXTRA_FRAMES,
    );
  }

  private saveOriginalImageCount(layerId: string): void {
    if (this.originalImageCount.has(layerId)) return;
    const controls = this.layerControlService.getControls(layerId);
    if (controls.type === LayerType.TILE) {
      this.originalImageCount.set(layerId, controls.playback.imageCount);
    }
  }

  private restoreOriginalImageCount(layerId: string): void {
    const original = this.originalImageCount.get(layerId);
    if (original !== undefined) {
      this.layerControlService.setImageCount(layerId, original);
      this.originalImageCount.delete(layerId);
    }
  }

  private computeEfc(
    layerData: ReadonlyMap<string, { readonly tilesets: readonly TilesetEntry[] }>,
    baseIndices: ReadonlyMap<string, number>,
    N: number,
  ): number {
    if (layerData.size === 0) return 0;
    let min = N;
    for (const [id, { tilesets }] of layerData) {
      min = Math.min(min, tilesets.length - (baseIndices.get(id) ?? 0));
    }
    return Math.max(1, min);
  }
}
