import { computeWindowStart } from './playback-window';
import { DEFAULT_SYNC_CUSTOMIZATION, SyncCustomization, SyncFrameSpec } from '../models';

/** A layer's tileset timeline, reduced to what the alignment needs. */
export interface SyncTimeline {
  readonly id: string;
  /** Tileset timestamps in ms, ascending. */
  readonly timestamps: readonly number[];
  readonly isForecast: boolean;
}

/** A layer's images, all the hand-drawn frames need. */
export type SyncLaneImages = Pick<SyncTimeline, 'id' | 'timestamps'>;

/** One frame of a group timeline. */
export interface SyncFrame {
  /** The average time of the images the frame joins: what orders and labels it. */
  readonly time: number;
  /** The images the frame joins, tileset index per layer: its line in the timeline. */
  readonly members: ReadonlyMap<string, number>;
  /** The tileset each layer shows: its member, or for the others the image they hold. */
  readonly indices: ReadonlyMap<string, number>;
}

export interface SyncPlan {
  readonly frames: readonly SyncFrame[];
}

/** An image of a layer, by its timestamp. */
export interface SyncImage {
  readonly layerId: string;
  readonly time: number;
}

/** Median gap between consecutive timestamps; `null` with fewer than two. */
export function medianIntervalMs(timestamps: readonly number[]): number | null {
  if (timestamps.length < 2) return null;
  const gaps = timestamps
    .slice(1)
    .map((t, i) => t - timestamps[i])
    .sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * The layer that sets the group's automatic frames: the one with the sparsest cadence, so
 * every frame is an instant the slowest layer actually has. Ties keep the earliest (topmost).
 */
export function pickAnchor(timelines: readonly SyncTimeline[]): SyncTimeline | null {
  let anchor: SyncTimeline | null = null;
  let anchorInterval = -1;
  for (const timeline of timelines) {
    const interval = medianIntervalMs(timeline.timestamps) ?? 0;
    if (interval > anchorInterval) {
      anchor = timeline;
      anchorInterval = interval;
    }
  }
  return anchor;
}

/** The average time of a frame's images. */
function meanTime(
  layers: readonly Pick<SyncTimeline, 'id' | 'timestamps'>[],
  members: ReadonlyMap<string, number>,
): number {
  const times = layers.flatMap(({ id, timestamps }) => {
    const index = members.get(id);
    return index === undefined ? [] : [timestamps[index]];
  });
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
}

/** The image of `timestamps` nearest `target` within `toleranceMs`, after index `after`, or -1. */
function nearestIndex(
  timestamps: readonly number[],
  target: number,
  toleranceMs: number,
  after: number,
): number {
  let best = -1;
  let bestDiff = Infinity;
  timestamps.forEach((time, i) => {
    const diff = Math.abs(time - target);
    if (diff < bestDiff && i > after) {
      best = i;
      bestDiff = diff;
    }
  });
  return bestDiff <= toleranceMs ? best : -1;
}

/**
 * The automatic frames, as the specs a frame drawn by hand would have: the anchor's window
 * of images (its last `frameCount`, or first for forecasts), each joined with every other
 * layer's nearest image within `toleranceMs` after the one it took for the previous instant
 * (so no layer goes back in time, and each image is used once). A layer with no image
 * near an instant sits that frame out and holds its image, as in a frame drawn by hand.
 */
export function autoSpecs(
  layers: readonly SyncTimeline[],
  frameCount: number,
  toleranceMs: number,
): SyncFrameSpec[] {
  const anchor = pickAnchor(layers);
  if (!anchor) return [];
  const start = computeWindowStart(anchor.timestamps.length, frameCount, anchor.isForecast);
  const instants = anchor.timestamps.slice(start, start + frameCount);
  const specs = instants.map((time): Record<string, number> => ({ [anchor.id]: time }));
  for (const layer of layers) {
    if (layer === anchor) continue;
    let last = -1;
    instants.forEach((time, k) => {
      const index = nearestIndex(layer.timestamps, time, toleranceMs, last);
      if (index < 0) return;
      last = index;
      specs[k][layer.id] = layer.timestamps[index];
    });
  }
  return specs;
}

/**
 * The frames of a list of specs, in time order. A layer a frame leaves out holds its image from
 * the previous frame that has it (before its first one, it shows that first one).
 */
function resolveFrames(
  layers: readonly SyncLaneImages[],
  specs: readonly SyncFrameSpec[],
): SyncFrame[] {
  const resolved = specs
    .flatMap((spec) => {
      const members = new Map<string, number>();
      for (const layer of layers) {
        const index = spec[layer.id] === undefined ? -1 : layer.timestamps.indexOf(spec[layer.id]);
        if (index >= 0) members.set(layer.id, index);
      }
      return members.size > 0 ? [{ time: meanTime(layers, members), members }] : [];
    })
    .sort((a, b) => a.time - b.time);

  return resolved.map((frame, k) => {
    const indices = new Map<string, number>();
    for (const { id } of layers) {
      const held =
        resolved
          .slice(0, k + 1)
          .reverse()
          .find((f) => f.members.has(id)) ?? resolved.slice(k + 1).find((f) => f.members.has(id));
      if (held) indices.set(id, held.members.get(id)!);
    }
    return { ...frame, indices };
  });
}

/** Builds a group's frames: the automatic ones, or the ones the user drew. */
export function buildSyncPlan(
  timelines: readonly SyncTimeline[],
  frameCount: number,
  toleranceMs: number,
  custom: SyncCustomization = DEFAULT_SYNC_CUSTOMIZATION,
): SyncPlan {
  const layers = timelines.filter((t) => t.timestamps.length > 0);
  return planFromSpecs(layers, custom.frames ?? autoSpecs(layers, frameCount, toleranceMs));
}

/**
 * Where a plan makes a layer go back in time: the first frame showing an image of some layer
 * older than the one an earlier frame showed (their lines cross), or null when none does.
 */
export function backwardsLayer(
  plan: SyncPlan,
): { readonly layerId: string; readonly frame: number } | null {
  const last = new Map<string, number>();
  for (const [frame, { members }] of plan.frames.entries()) {
    for (const [layerId, index] of members) {
      if ((last.get(layerId) ?? -1) > index) return { layerId, frame };
      last.set(layerId, index);
    }
  }
  return null;
}

/** How many of a plan's frames join an image of the layer: how much of it animates. */
export function framesJoining(plan: SyncPlan, layerId: string): number {
  return plan.frames.filter((frame) => frame.members.has(layerId)).length;
}

/** The plan a list of frame specs plays: automatic, drawn by hand, or an edit's preview. */
export function planFromSpecs(
  layers: readonly SyncLaneImages[],
  specs: readonly SyncFrameSpec[],
): SyncPlan {
  return {
    frames: resolveFrames(
      layers.filter((t) => t.timestamps.length > 0),
      specs,
    ),
  };
}

/** Whether two plans play the same frames (so a re-listing with the same images is a no-op). */
export function samePlan(a: SyncPlan, b: SyncPlan): boolean {
  const sameMap = (x: ReadonlyMap<string, number>, y: ReadonlyMap<string, number>) =>
    x.size === y.size && [...x].every(([id, index]) => y.get(id) === index);
  return (
    a.frames.length === b.frames.length &&
    a.frames.every(
      (f, i) =>
        f.time === b.frames[i].time &&
        sameMap(f.members, b.frames[i].members) &&
        sameMap(f.indices, b.frames[i].indices),
    )
  );
}

/** Frames only, for callers that don't need the full plan. */
export function buildSyncFrames(
  timelines: readonly SyncTimeline[],
  frameCount: number,
  toleranceMs: number,
  custom?: SyncCustomization,
): SyncFrame[] {
  return [...buildSyncPlan(timelines, frameCount, toleranceMs, custom).frames];
}

// ============================================================================
// Hand edits, on the frames as specs (in plan order)
// ============================================================================

/** A plan's frames as specs, so the user's first edit starts from what they see. */
export function frameSpecs(plan: SyncPlan, timelines: readonly SyncLaneImages[]): SyncFrameSpec[] {
  const byId = new Map(timelines.map((t) => [t.id, t.timestamps]));
  return plan.frames.map((frame) =>
    Object.fromEntries([...frame.members].map(([id, index]) => [id, byId.get(id)![index]])),
  );
}

/** Index of the first frame that joins `image`, or -1. */
export function frameWith(specs: readonly SyncFrameSpec[], image: SyncImage): number {
  return specs.findIndex((spec) => spec[image.layerId] === image.time);
}

/** Adds an image to a frame, replacing its layer's image, or takes it out if already there. */
export function toggleImage(spec: SyncFrameSpec, image: SyncImage): SyncFrameSpec {
  if (spec[image.layerId] === image.time) {
    return Object.fromEntries(Object.entries(spec).filter(([id]) => id !== image.layerId));
  }
  return { ...spec, [image.layerId]: image.time };
}

/** Replaces the frame at `index` (appends it when null); a frame left empty is deleted. */
export function setFrame(
  specs: readonly SyncFrameSpec[],
  index: number | null,
  spec: SyncFrameSpec,
): SyncFrameSpec[] {
  const empty = Object.keys(spec).length === 0;
  if (index === null) return empty ? [...specs] : [...specs, spec];
  return specs.flatMap((s, i) => (i !== index ? [s] : empty ? [] : [spec]));
}

export function removeFrame(specs: readonly SyncFrameSpec[], index: number): SyncFrameSpec[] {
  return specs.filter((_, i) => i !== index);
}

/** Where a frame ended up after an edit (frames re-sort by time), or null. */
export function indexOfSpec(specs: readonly SyncFrameSpec[], spec: SyncFrameSpec): number | null {
  const key = (s: SyncFrameSpec) => JSON.stringify(Object.entries(s).sort());
  const index = specs.findIndex((s) => key(s) === key(spec));
  return index >= 0 ? index : null;
}
