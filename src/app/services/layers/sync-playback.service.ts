import { Injectable, inject, signal, computed, effect, untracked } from '@angular/core';
import {
  Layer,
  LayerType,
  PLAYBACK_SPEED_LIMITS,
  SyncGroupId,
  SyncGroupState,
  SyncLayerStatus,
  SyncState,
  SyncCustomization,
  SyncFrameSpec,
  DEFAULT_SYNC_CUSTOMIZATION,
} from '../../models';
import {
  SYNC_GROUPS,
  syncGroupDefinition,
  syncGroupForCategory,
} from '../../config/layers/sync-groups.config';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import { PlaybackEngineService } from './playback-engine.service';
import {
  buildSyncPlan,
  framesJoining,
  frameSpecs,
  medianIntervalMs,
  pickAnchor,
  SyncPlan,
  SyncTimeline,
} from '../../utils/sync-alignment';

type SyncTileLayer = Extract<Layer, { type: LayerType.TILE }>;

/** A layer of a sync group and whether it follows the group's timeline. */
export interface SyncGroupLayer {
  readonly layer: SyncTileLayer;
  readonly status: SyncLayerStatus;
}

interface GroupEnrollment {
  readonly layers: readonly SyncGroupLayer[];
  readonly enrolledIds: readonly string[];
  /** The enrolled layers' images, for drawing the timeline. */
  readonly timelines: readonly SyncTimeline[];
  readonly plan: SyncPlan;
}

const EMPTY_PLAN: SyncPlan = { frames: [] };

/** A group only takes over its layers' timelines once it can actually sync two of them. */
const MIN_SYNC_LAYERS = 2;

/** Frames a layer must join to be part of a group: fewer and it would barely animate. */
const MIN_JOINED_FRAMES = 2;

/** Extra images per layer beyond the window, so an offset layer still covers its ends. */
const EXTRA_IMAGES = 2;

const engineId = (groupId: SyncGroupId): string => `sync:${groupId}`;

const initialGroupState = (): SyncGroupState => ({
  excludedLayerIds: [],
  frameCount: null,
  frameIndex: 0,
  custom: DEFAULT_SYNC_CUSTOMIZATION,
  speed: 1,
  isPlaying: false,
});

const sameIds = (a: readonly { id: string }[], b: readonly { id: string }[]): boolean =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id);

/**
 * Synchronized playback, one independent timeline per sync group (see SYNC_GROUPS), each
 * with its own window, speed and engine session.
 *
 * Enrollment is opt-out: every active tile layer of a group follows its timeline unless the
 * user unchecks it in the Sincronización tab or detaches it from the layer's own controls.
 * The group's sparsest layer sets the instants; every other layer shows its nearest image
 * within the group's tolerance, and an instant some layer can't match is skipped. A layer
 * that matches no instant at all stays out. A group takes over only with MIN_SYNC_LAYERS.
 *
 * Each enrolled layer loads enough images to cover the window at its own cadence; its own
 * image count is restored when it leaves. A layer that joins a group while it plays is
 * folded into the running animation; a paused group stays paused.
 */
@Injectable({ providedIn: 'root' })
export class SyncPlaybackService {
  private readonly layerControlService = inject(LayerControlService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly engineService = inject(PlaybackEngineService);

  private readonly originalImageCount = new Map<string, number>();

  private readonly state = signal<SyncState>({
    observations: initialGroupState(),
    models: initialGroupState(),
  });

  readonly syncState = this.state.asReadonly();

  // ============================================================================
  // Derived state
  // ============================================================================

  /**
   * Active tile layers per group, topmost first. Compared by id so per-frame control
   * updates (timeIndex) don't recompute the groups.
   */
  private readonly candidates = computed(
    (): Readonly<Record<SyncGroupId, readonly SyncTileLayer[]>> => {
      const byGroup: Record<SyncGroupId, SyncTileLayer[]> = { observations: [], models: [] };
      const sorted = [...this.layerControlService.activeLayers()].sort(
        (a, b) => (b.controls.zIndex ?? 0) - (a.controls.zIndex ?? 0),
      );
      for (const { layer } of sorted) {
        if (layer.type !== LayerType.TILE) continue;
        const groupId = syncGroupForCategory(layer.category);
        if (groupId) byGroup[groupId].push(layer);
      }
      return byGroup;
    },
    { equal: (a, b) => SYNC_GROUPS.every(({ id }) => sameIds(a[id], b[id])) },
  );

  /** The slice of group state that drives enrollment, so frame ticks don't recompute it. */
  private readonly settings = this.perGroup((groupId) =>
    computed(
      () => {
        const { excludedLayerIds, frameCount, custom } = this.state()[groupId];
        return { excludedLayerIds, frameCount, custom };
      },
      {
        equal: (a, b) =>
          a.excludedLayerIds === b.excludedLayerIds &&
          a.frameCount === b.frameCount &&
          a.custom === b.custom,
      },
    ),
  );

  private readonly enrollment = this.perGroup((groupId) =>
    computed(() => this.computeEnrollment(groupId)),
  );

  /** Groups with at least one active layer, in display order. */
  readonly activeGroupIds = computed((): readonly SyncGroupId[] =>
    SYNC_GROUPS.filter(({ id }) => this.candidates()[id].length > 0).map(({ id }) => id),
  );

  readonly isAnyPlaying = computed(() => SYNC_GROUPS.some(({ id }) => this.state()[id].isPlaying));

  /** Layers of the groups that are playing right now (the tab's badge). */
  readonly syncingLayerCount = computed(() =>
    SYNC_GROUPS.reduce(
      (total, { id }) =>
        total + (this.state()[id].isPlaying ? this.enrollment[id]().enrolledIds.length : 0),
      0,
    ),
  );

  /** Frame count of each playing group (null when paused), for the engine effect. */
  private readonly playingFrameCounts = computed(
    () => SYNC_GROUPS.map(({ id }) => (this.state()[id].isPlaying ? this.frameTotal(id) : null)),
    { equal: (a, b) => a.every((v, i) => v === b[i]) },
  );

  constructor() {
    // Load enough images for each group's window, restore layers that left, and forget
    // opt-outs of deactivated layers so re-enabling one enrolls it again.
    effect(() => {
      const targets = new Map<string, number>();
      const activeIds = new Set<string>();
      for (const { id } of SYNC_GROUPS) {
        const candidates = this.candidates()[id];
        candidates.forEach((layer) => activeIds.add(layer.id));
        this.imageCountTargets(id).forEach((count, layerId) => targets.set(layerId, count));
      }
      untracked(() => {
        this.applyImageCounts(targets);
        this.pruneExclusions(activeIds);
      });
    });

    // A layer that joins a playing group follows the running animation right away.
    effect(() => {
      const enrolled = SYNC_GROUPS.map(({ id }) => this.enrollment[id]().enrolledIds);
      untracked(() => this.foldIntoPlayingGroups(enrolled));
    });

    // Follow window changes while playing (layers joining/leaving, new images).
    effect(() => {
      const frameCounts = this.playingFrameCounts();
      untracked(() =>
        SYNC_GROUPS.forEach(({ id }, i) => {
          const total = frameCounts[i];
          if (total === null) return;
          if (total < 2) {
            this.pause(id);
          } else {
            this.engineService.setFrameCount(engineId(id), total);
          }
        }),
      );
    });
  }

  // ============================================================================
  // Public queries
  // ============================================================================

  groupState(groupId: SyncGroupId): SyncGroupState {
    return this.state()[groupId];
  }

  groupLayers(groupId: SyncGroupId): readonly SyncGroupLayer[] {
    return this.enrollment[groupId]().layers;
  }

  /** Images of the group's layers left out of its timeline, with why, to show them apart. */
  groupOtherTimelines(
    groupId: SyncGroupId,
  ): readonly { readonly timeline: SyncTimeline; readonly status: SyncLayerStatus }[] {
    const shown = new Set(this.enrolledLayerIds(groupId));
    return this.groupLayers(groupId).flatMap(({ layer, status }) => {
      const timeline = shown.has(layer.id) ? null : this.timeline(layer);
      return timeline ? [{ timeline, status }] : [];
    });
  }

  enrolledLayerIds(groupId: SyncGroupId): readonly string[] {
    return this.enrollment[groupId]().enrolledIds;
  }

  frameCountOptions(groupId: SyncGroupId): readonly number[] {
    return syncGroupDefinition(groupId).frameCounts;
  }

  /** The window size in use: the requested one when valid, else the group default. */
  frameCount(groupId: SyncGroupId): number {
    const { frameCounts, defaultFrameCount } = syncGroupDefinition(groupId);
    const requested = this.settings[groupId]().frameCount;
    return requested !== null && frameCounts.includes(requested) ? requested : defaultFrameCount;
  }

  /** Frames the group plays: the automatic ones (minus unmatched instants) or the drawn ones. */
  frameTotal(groupId: SyncGroupId): number {
    return this.enrollment[groupId]().plan.frames.length;
  }

  canPlay(groupId: SyncGroupId): boolean {
    return this.frameTotal(groupId) >= 2;
  }

  /** The group's frames, with the images each joins, for the timeline dialog. */
  groupPlan(groupId: SyncGroupId): SyncPlan {
    return this.enrollment[groupId]().plan;
  }

  groupTimelines(groupId: SyncGroupId): readonly SyncTimeline[] {
    return this.enrollment[groupId]().timelines;
  }

  customization(groupId: SyncGroupId): SyncCustomization {
    return this.settings[groupId]().custom;
  }

  isCustomized(groupId: SyncGroupId): boolean {
    return this.customization(groupId) !== DEFAULT_SYNC_CUSTOMIZATION;
  }

  /** Why a group can't play yet, in one line; null when it can. */
  groupHint(groupId: SyncGroupId): string | null {
    if (this.canPlay(groupId)) return null;
    const included = this.includedLayers(groupId);
    if (included.length < MIN_SYNC_LAYERS) return syncGroupDefinition(groupId).peerHint;
    if (included.some((layer) => !this.timeline(layer))) return 'Cargando imágenes…';
    if (this.isCustomized(groupId)) return 'Uní al menos dos cuadros en la línea de tiempo';
    return 'Las capas no tienen horarios en común';
  }

  /** Whether the layer belongs to its group's timeline (playing or paused). */
  isLayerSelected(layerId: string): boolean {
    const groupId = this.groupOfLayer(layerId);
    return groupId !== null && this.enrolledLayerIds(groupId).includes(layerId);
  }

  /** Whether the layer's group is playing it right now: only then it takes over its controls. */
  isLayerSyncing(layerId: string): boolean {
    const groupId = this.groupOfLayer(layerId);
    return groupId !== null && this.groupState(groupId).isPlaying && this.isLayerSelected(layerId);
  }

  /** The instant a frame of the group shows. */
  frameTime(groupId: SyncGroupId, frameIndex: number): Date | null {
    const frame = this.enrollment[groupId]().plan.frames[frameIndex];
    return frame ? new Date(frame.time) : null;
  }

  // ============================================================================
  // Public actions — layer selection
  // ============================================================================

  /** Opts a layer in or out of its group from the Sincronización tab. */
  setLayerIncluded(layerId: string, included: boolean): void {
    const groupId = this.groupOfLayer(layerId);
    if (!groupId) return;
    this.updateGroup(groupId, (g) => ({
      ...g,
      excludedLayerIds: included
        ? g.excludedLayerIds.filter((id) => id !== layerId)
        : [...new Set([...g.excludedLayerIds, layerId])],
    }));
  }

  /**
   * Opts a layer out of its group without restoring the original imageCount.
   * Used when the user interacts with the layer's own controls (slider, play, image count)
   * so the current sync values are preserved for individual playback.
   */
  detachLayer(layerId: string): void {
    if (!this.isLayerSelected(layerId)) return;
    this.originalImageCount.delete(layerId);
    this.setLayerIncluded(layerId, false);
  }

  // ============================================================================
  // Public actions — playback control
  // ============================================================================

  /** Picking a window size from the tab goes back to the automatic frames. */
  setFrameCount(groupId: SyncGroupId, frameCount: number): void {
    this.updateGroup(groupId, (g) => ({
      ...g,
      frameCount,
      custom: DEFAULT_SYNC_CUSTOMIZATION,
      frameIndex: Math.min(g.frameIndex, Math.max(0, frameCount - 1)),
    }));
  }

  /** The frames the group plays, as specs to edit by hand. */
  frameSpecs(groupId: SyncGroupId): SyncFrameSpec[] {
    return frameSpecs(this.groupPlan(groupId), this.groupTimelines(groupId));
  }

  /** Plays the frames drawn by hand in the timeline dialog. */
  setFrames(groupId: SyncGroupId, frames: readonly SyncFrameSpec[]): void {
    this.setCustomization(groupId, () => ({ frames: [...frames] }));
  }

  /** Back to the automatic, optimal frames. */
  resetCustomization(groupId: SyncGroupId): void {
    this.setCustomization(groupId, () => DEFAULT_SYNC_CUSTOMIZATION);
  }

  setFrameIndex(groupId: SyncGroupId, frameIndex: number): void {
    const total = this.frameTotal(groupId);
    const clamped = Math.max(0, Math.min(frameIndex, Math.max(0, total - 1)));
    this.updateGroup(groupId, (g) => ({ ...g, frameIndex: clamped }));
    this.updateLayersForFrame(groupId, clamped);
  }

  setSpeed(groupId: SyncGroupId, speed: number): void {
    const clamped = Math.max(PLAYBACK_SPEED_LIMITS.MIN, Math.min(PLAYBACK_SPEED_LIMITS.MAX, speed));
    this.updateGroup(groupId, (g) => ({ ...g, speed: clamped }));
    if (this.groupState(groupId).isPlaying) {
      this.engineService.setSpeed(engineId(groupId), clamped);
    }
  }

  togglePlayback(groupId: SyncGroupId): void {
    if (this.groupState(groupId).isPlaying) {
      this.pause(groupId);
    } else {
      this.play(groupId);
    }
  }

  play(groupId: SyncGroupId): void {
    const { frameIndex, speed, isPlaying } = this.groupState(groupId);
    const total = this.frameTotal(groupId);
    if (isPlaying || total < 2) return;

    this.enrolledLayerIds(groupId).forEach((id) => this.layerControlService.stopPlayback(id));

    const session = engineId(groupId);
    this.engineService.register(session, total, speed);
    this.engineService.setFrameIndex(session, Math.min(frameIndex, total - 1));
    this.updateGroup(groupId, (g) => ({ ...g, isPlaying: true }));

    this.engineService.play(session, (fi) => {
      this.updateGroup(groupId, (g) => ({ ...g, frameIndex: fi }));
      this.updateLayersForFrame(groupId, fi);
    });
  }

  pause(groupId: SyncGroupId): void {
    this.engineService.pause(engineId(groupId));
    this.updateGroup(groupId, (g) => ({ ...g, isPlaying: false }));
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private perGroup<T>(factory: (groupId: SyncGroupId) => T): Readonly<Record<SyncGroupId, T>> {
    return { observations: factory('observations'), models: factory('models') };
  }

  private updateGroup(groupId: SyncGroupId, fn: (g: SyncGroupState) => SyncGroupState): void {
    this.state.update((s) => ({ ...s, [groupId]: fn(s[groupId]) }));
  }

  private setCustomization(
    groupId: SyncGroupId,
    fn: (custom: SyncCustomization) => SyncCustomization,
  ): void {
    this.updateGroup(groupId, (g) => ({ ...g, custom: fn(g.custom), frameIndex: 0 }));
    if (this.groupState(groupId).isPlaying) {
      this.engineService.setFrameIndex(engineId(groupId), 0);
    } else {
      this.updateLayersForFrame(groupId, 0);
    }
  }

  private groupOfLayer(layerId: string): SyncGroupId | null {
    return (
      SYNC_GROUPS.find(({ id }) => this.candidates()[id].some((layer) => layer.id === layerId))
        ?.id ?? null
    );
  }

  private includedLayers(groupId: SyncGroupId): readonly SyncTileLayer[] {
    const excluded = new Set(this.settings[groupId]().excludedLayerIds);
    return this.candidates()[groupId].filter((layer) => !excluded.has(layer.id));
  }

  private timeline(layer: SyncTileLayer): SyncTimeline | null {
    const tilesets = this.layerConfigService.getAvailableTilesets(layer.id);
    if (!tilesets?.length) return null;
    return {
      id: layer.id,
      timestamps: tilesets.map((e) => e.time.getTime()),
      isForecast: layer.isForecast,
    };
  }

  /**
   * Adds layers in priority order (topmost first), each only if, with it, every layer joins
   * at least MIN_JOINED_FRAMES automatic frames (so each of them actually animates).
   * Hand-drawn frames don't take part, so deleting them never drops a layer from the group. Fewer than MIN_SYNC_LAYERS enrolled means the group is
   * not syncing yet and its layers keep their own controls.
   */
  private computeEnrollment(groupId: SyncGroupId): GroupEnrollment {
    const { toleranceMs } = syncGroupDefinition(groupId);
    const frameCount = this.frameCount(groupId);
    const { excludedLayerIds, custom } = this.settings[groupId]();
    const excluded = new Set(excludedLayerIds);
    const statuses = new Map<string, SyncLayerStatus>();
    const enrolled: SyncTimeline[] = [];
    for (const layer of this.includedLayers(groupId)) {
      const timeline = this.timeline(layer);
      if (!timeline) {
        statuses.set(layer.id, 'waiting');
        continue;
      }
      const candidates = [...enrolled, timeline];
      const trial = buildSyncPlan(candidates, frameCount, toleranceMs);
      const animates = candidates.every(({ id }) => framesJoining(trial, id) >= MIN_JOINED_FRAMES);
      if (enrolled.length > 0 && !animates) {
        statuses.set(layer.id, 'unaligned');
        continue;
      }
      enrolled.push(timeline);
      statuses.set(layer.id, 'enrolled');
    }

    if (enrolled.length < MIN_SYNC_LAYERS) {
      enrolled.forEach(({ id }) => statuses.set(id, 'waiting'));
      return {
        layers: this.withStatuses(groupId, statuses, excluded),
        enrolledIds: [],
        timelines: enrolled,
        plan: EMPTY_PLAN,
      };
    }

    return {
      layers: this.withStatuses(groupId, statuses, excluded),
      enrolledIds: enrolled.map(({ id }) => id),
      timelines: enrolled,
      plan: buildSyncPlan(enrolled, frameCount, toleranceMs, custom),
    };
  }

  private withStatuses(
    groupId: SyncGroupId,
    statuses: ReadonlyMap<string, SyncLayerStatus>,
    excluded: ReadonlySet<string>,
  ): SyncGroupLayer[] {
    return this.candidates()[groupId].map((layer) => ({
      layer,
      status: excluded.has(layer.id) ? 'excluded' : (statuses.get(layer.id) ?? 'waiting'),
    }));
  }

  /**
   * Images each included layer should load so the window covers the same span at its own
   * cadence: a layer twice as frequent as the group's sparsest needs twice the images.
   */
  private imageCountTargets(groupId: SyncGroupId): ReadonlyMap<string, number> {
    const layers = this.includedLayers(groupId);
    if (layers.length < MIN_SYNC_LAYERS) return new Map();

    const frameCount = this.frameCount(groupId);
    const timelines = layers.map((layer) => this.timeline(layer));
    const anchor = pickAnchor(timelines.filter((t): t is SyncTimeline => t !== null));
    const anchorInterval = anchor ? medianIntervalMs(anchor.timestamps) : null;

    return new Map(
      layers.map((layer, i) => {
        const ownInterval = timelines[i] ? medianIntervalMs(timelines[i]!.timestamps) : null;
        const frames =
          anchorInterval && ownInterval
            ? Math.ceil(((frameCount - 1) * anchorInterval) / ownInterval) + 1
            : frameCount;
        return [layer.id, frames + EXTRA_IMAGES];
      }),
    );
  }

  /** Sets each enrolled layer's timeIndex to the tileset the group's frame assigns it. */
  private updateLayersForFrame(groupId: SyncGroupId, frameIndex: number): void {
    const frame = this.enrollment[groupId]().plan.frames[frameIndex];
    frame?.indices.forEach((index, layerId) =>
      this.layerControlService.setTimeIndex(layerId, index),
    );
  }

  /** Stops the enrolled layers' own playback and puts them on a playing group's frame. */
  private foldIntoPlayingGroups(enrolledIds: readonly (readonly string[])[]): void {
    SYNC_GROUPS.forEach(({ id }, i) => {
      const { isPlaying, frameIndex } = this.state()[id];
      if (!isPlaying) return;
      enrolledIds[i].forEach((layerId) => this.layerControlService.stopPlayback(layerId));
      this.updateLayersForFrame(id, frameIndex);
    });
  }

  private applyImageCounts(targets: ReadonlyMap<string, number>): void {
    for (const [layerId, count] of targets) {
      const controls = this.layerControlService.getControls(layerId);
      if (controls?.type !== LayerType.TILE) continue;
      if (!this.originalImageCount.has(layerId)) {
        this.originalImageCount.set(layerId, controls.playback.imageCount);
      }
      if (controls.playback.imageCount !== count) {
        this.layerControlService.setImageCount(layerId, count);
      }
    }
    for (const [layerId, original] of [...this.originalImageCount]) {
      if (targets.has(layerId)) continue;
      this.originalImageCount.delete(layerId);
      this.layerControlService.setImageCount(layerId, original);
    }
  }

  private pruneExclusions(activeIds: ReadonlySet<string>): void {
    for (const { id } of SYNC_GROUPS) {
      const { excludedLayerIds } = this.state()[id];
      if (excludedLayerIds.every((layerId) => activeIds.has(layerId))) continue;
      this.updateGroup(id, (g) => ({
        ...g,
        excludedLayerIds: g.excludedLayerIds.filter((layerId) => activeIds.has(layerId)),
      }));
    }
  }
}
