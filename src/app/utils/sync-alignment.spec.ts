import { describe, it, expect } from 'vitest';
import {
  backwardsLayer,
  buildSyncFrames,
  buildSyncPlan,
  frameSpecs,
  indexOfSpec,
  planFromSpecs,
  medianIntervalMs,
  pickAnchor,
  removeFrame,
  samePlan,
  setFrame,
  SyncTimeline,
  toggleImage,
} from './sync-alignment';

const MIN = 60 * 1000;
const base = new Date('2024-01-15T10:00:00Z').getTime();
const TOLERANCE = 5 * MIN;

/** `count` timestamps every `intervalMin`, starting `offsetMin` after `base`. */
function timeline(
  id: string,
  count: number,
  intervalMin = 10,
  offsetMin = 0,
  isForecast = false,
): SyncTimeline {
  return {
    id,
    timestamps: Array.from({ length: count }, (_, i) => base + (offsetMin + i * intervalMin) * MIN),
    isForecast,
  };
}

const minutesOf = (time: number) => (time - base) / MIN;

describe('medianIntervalMs', () => {
  it('is null with fewer than two timestamps', () => {
    expect(medianIntervalMs([])).toBeNull();
    expect(medianIntervalMs([base])).toBeNull();
  });

  it('ignores a single irregular gap', () => {
    expect(medianIntervalMs([0, 10, 20, 50, 60].map((m) => m * MIN))).toBe(10 * MIN);
  });
});

describe('pickAnchor', () => {
  it('picks the sparsest cadence', () => {
    expect(pickAnchor([timeline('fast', 12, 5), timeline('slow', 6, 10)])?.id).toBe('slow');
  });

  it('keeps the first on a tie', () => {
    expect(pickAnchor([timeline('a', 6), timeline('b', 6)])?.id).toBe('a');
  });
});

describe('buildSyncFrames', () => {
  it('returns no frames without timelines', () => {
    expect(buildSyncFrames([], 6, TOLERANCE)).toEqual([]);
  });

  it('uses the last N frames of observations', () => {
    const frames = buildSyncFrames([timeline('a', 10)], 4, TOLERANCE);
    expect(frames.map((f) => minutesOf(f.time))).toEqual([60, 70, 80, 90]);
  });

  it('uses the first N frames of forecasts', () => {
    const frames = buildSyncFrames([timeline('a', 10, 60, 0, true)], 3, TOLERANCE);
    expect(frames.map((f) => minutesOf(f.time))).toEqual([0, 60, 120]);
  });

  it('pairs each layer with its nearest image within tolerance', () => {
    const frames = buildSyncFrames([timeline('a', 6), timeline('b', 6, 10, 3)], 6, TOLERANCE);

    expect(frames).toHaveLength(6);
    expect(frames[0].indices.get('b')).toBe(0);
  });

  it('leaves a layer out of an instant it has no image near, holding its image', () => {
    const gappy: SyncTimeline = {
      id: 'b',
      timestamps: [0, 10, 30, 40, 50].map((m) => base + m * MIN), // 20' is missing
      isForecast: false,
    };

    const frames = buildSyncFrames([timeline('a', 6), gappy], 6, TOLERANCE);

    expect(frames.map((f) => minutesOf(f.time))).toEqual([0, 10, 20, 30, 40, 50]);
    expect(frames[2].members.has('b')).toBe(false);
    expect(frames[2].indices.get('b')).toBe(1);
  });

  it('never sends a layer back in time, even with a wide tolerance', () => {
    // With 10' of tolerance, b's 7' is near 15' but older than the 11' taken for 10'.
    const b: SyncTimeline = {
      id: 'b',
      timestamps: [7, 11].map((m) => base + m * MIN),
      isForecast: false,
    };
    const a: SyncTimeline = {
      id: 'a',
      timestamps: [10, 15].map((m) => base + m * MIN),
      isForecast: false,
    };

    const plan = buildSyncPlan([a, b], 2, 10 * MIN);

    expect(backwardsLayer(plan)).toBeNull();
  });

  it('uses each image in one frame only', () => {
    // b's image at 15' is as near 10' as 20': the first instant takes it.
    const sparse: SyncTimeline = { id: 'b', timestamps: [base + 15 * MIN], isForecast: false };

    const frames = buildSyncFrames([timeline('a', 3, 10, 0), sparse], 3, TOLERANCE);

    expect(frames.filter((f) => f.members.has('b'))).toHaveLength(1);
  });

  it('follows the sparsest layer when cadences differ', () => {
    // a every 5', b every 10': frames are b's instants, a picks the matching one.
    const frames = buildSyncFrames([timeline('a', 24, 5), timeline('b', 12, 10)], 6, TOLERANCE);

    expect(frames.map((f) => minutesOf(f.time))).toEqual([60, 70, 80, 90, 100, 110]);
    expect(frames[0].indices.get('a')).toBe(12);
  });

  it('joins no image of a layer that never meets the anchor', () => {
    const frames = buildSyncFrames([timeline('a', 6), timeline('b', 6, 10, 300)], 6, TOLERANCE);

    expect(frames.some((f) => f.members.has('b'))).toBe(false);
  });
});

describe('buildSyncPlan with frames drawn by hand', () => {
  const at = (m: number) => base + m * MIN;
  const plan = (frames: Record<string, number>[]) =>
    buildSyncPlan([timeline('a', 4), timeline('b', 4)], 4, TOLERANCE, { frames });

  it('plays exactly the drawn frames, ordered by the average time of their images', () => {
    const { frames } = plan([{ a: at(30), b: at(0) }, { a: at(10) }]);

    expect(frames.map((f) => minutesOf(f.time))).toEqual([10, 15]);
    expect(frames[1].members).toEqual(
      new Map([
        ['a', 3],
        ['b', 0],
      ]),
    );
  });

  it('holds the previous image of a layer a frame leaves out', () => {
    const { frames } = plan([{ a: at(0), b: at(0) }, { a: at(10) }]);

    expect(frames[1].members.has('b')).toBe(false);
    expect(frames[1].indices.get('b')).toBe(0);
  });

  it('shows the first image of a layer before the frame that first has it', () => {
    const { frames } = plan([{ a: at(0) }, { a: at(10), b: at(20) }]);

    expect(frames[0].indices.get('b')).toBe(2);
  });

  it('plays nothing when every frame was deleted', () => {
    expect(plan([]).frames).toEqual([]);
  });
});

describe('backwardsLayer', () => {
  const lanes = [timeline('a', 4), timeline('b', 4)];
  const at = (m: number) => base + m * MIN;

  it('finds where two frames cross, a layer going back in time', () => {
    const plan = planFromSpecs(lanes, [
      { a: at(0), b: at(20) },
      { a: at(10), b: at(10) },
    ]);

    expect(backwardsLayer(plan)).toEqual({ layerId: 'b', frame: 1 });
  });

  it('lets frames skip layers and share an image without crossing', () => {
    const plan = planFromSpecs(lanes, [
      { a: at(0), b: at(0) },
      { a: at(10) },
      { a: at(20), b: at(0) },
    ]);

    expect(backwardsLayer(plan)).toBeNull();
  });
});

describe('planFromSpecs', () => {
  it('is the plan the same frames drawn by hand play, from the images alone', () => {
    const lanes = [timeline('a', 4), timeline('b', 4)];
    const frames: Record<string, number>[] = [
      { a: base + 30 * MIN, b: base },
      { a: base + 10 * MIN },
    ];

    expect(
      samePlan(planFromSpecs(lanes, frames), buildSyncPlan(lanes, 4, TOLERANCE, { frames })),
    ).toBe(true);
  });
});

describe('samePlan', () => {
  it('treats plans rebuilt from the same images as equal', () => {
    const build = () => buildSyncPlan([timeline('a', 4), timeline('b', 4)], 4, TOLERANCE);

    expect(samePlan(build(), build())).toBe(true);
    expect(samePlan(build(), buildSyncPlan([timeline('a', 4)], 4, TOLERANCE))).toBe(false);
  });
});

describe('frame edits', () => {
  it('adds images of any layer to a frame, in any order, replacing its layer image', () => {
    let spec = toggleImage({}, { layerId: 'c', time: 0 });
    spec = toggleImage(spec, { layerId: 'a', time: 1 });
    spec = toggleImage(spec, { layerId: 'c', time: 2 });

    expect(spec).toEqual({ c: 2, a: 1 });
  });

  it('takes an image out of a frame when clicked again', () => {
    expect(toggleImage({ a: 0, b: 0 }, { layerId: 'b', time: 0 })).toEqual({ a: 0 });
  });

  it('appends a new frame, replaces one, and deletes a frame left empty', () => {
    expect(setFrame([{ a: 0 }], null, { a: 1 })).toEqual([{ a: 0 }, { a: 1 }]);
    expect(setFrame([{ a: 0 }], 0, { a: 0, b: 0 })).toEqual([{ a: 0, b: 0 }]);
    expect(setFrame([{ a: 0 }], 0, {})).toEqual([]);
  });

  it('finds a frame after it re-sorts, whatever its key order', () => {
    expect(indexOfSpec([{ a: 0 }, { b: 1, a: 1 }], { a: 1, b: 1 })).toBe(1);
    expect(indexOfSpec([{ a: 0 }], { a: 5 })).toBeNull();
  });

  it('deletes a frame', () => {
    expect(removeFrame([{ a: 0 }, { a: 1 }], 0)).toEqual([{ a: 1 }]);
  });

  it('starts editing from the frames the plan shows', () => {
    const timelines = [timeline('a', 2), timeline('b', 2)];
    const specs = frameSpecs(buildSyncPlan(timelines, 2, TOLERANCE), timelines);

    expect(specs).toEqual([
      { a: base, b: base },
      { a: base + 10 * MIN, b: base + 10 * MIN },
    ]);
  });
});
