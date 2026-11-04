import { describe, it, expect } from 'vitest';
import { buildSyncPlan } from './sync-alignment';
import {
  buildSyncTimelineOption,
  lanesSpan,
  sameLanes,
  SyncChartLane,
  SyncChartSelection,
} from './sync-timeline-chart';
import { SyncFrameSpec } from '../models';

const MIN = 60 * 1000;
const COLORS = { primary: 'P', error: 'E', muted: 'M', grid: 'G', text: 'T', surface: 'S' };
const FORMATS = { time: String, day: String, full: String };

const lane = (id: string, minutes: number[]): SyncChartLane => ({
  id,
  name: `Capa ${id}`,
  timestamps: minutes.map((m) => m * MIN),
});

interface Series {
  type: string;
  data: {
    target?: { kind: string; index?: number; time?: number; layerId?: string };
    itemStyle?: { color: string; opacity?: number; borderColor?: string };
    lineStyle?: { color: string; width: number; opacity?: number; type?: string };
    label?: { formatter: string; fontWeight: string };
    coords?: [number, number][];
  }[];
}

function render(lanes: SyncChartLane[], frames?: SyncFrameSpec[], selection?: SyncChartSelection) {
  const plan = buildSyncPlan(
    lanes.map(({ id, timestamps }) => ({ id, timestamps, isForecast: false })),
    3,
    5 * MIN,
    { frames: frames ?? null },
  );
  const option = buildSyncTimelineOption(lanes, plan, COLORS, FORMATS, selection);
  const [lines, points, numbers, hits] = option['series'] as Series[];
  return { lines, points, numbers, hits };
}

describe('buildSyncTimelineOption', () => {
  it('dashes the part of a line over a lane the frame leaves out', () => {
    const lanes = [lane('a', [0]), lane('b', [0]), lane('c', [0])];
    const { lines } = render(lanes, [{ a: 0, c: 0 }]);

    expect(lines.data).toHaveLength(1);
    expect(lines.data[0].lineStyle?.type).toBe('dashed');
  });

  it('numbers the frames, stressing the one playing', () => {
    const lanes = [lane('a', [0, 10]), lane('b', [0, 10])];
    const { numbers } = render(
      lanes,
      [
        { a: 0, b: 0 },
        { a: 10 * MIN, b: 10 * MIN },
      ],
      {
        active: null,
        selected: null,
        current: 1,
      },
    );

    expect(numbers.data.map((d) => d.label?.formatter)).toEqual(['1', '2']);
    expect(numbers.data.map((d) => d.label?.fontWeight)).toEqual(['normal', 'bold']);
  });

  it('greys out a layer left out of the timeline, its images not clickable', () => {
    const plan = buildSyncPlan([], 3, 5 * MIN);
    const left = { ...lane('c', [0, 10]), note: 'sin horarios en común' };
    const option = buildSyncTimelineOption([left], plan, COLORS, FORMATS);
    const [, points] = option['series'] as Series[];

    expect(points.data.map((d) => d.target)).toEqual([undefined, undefined]);
    expect(points.data[0].itemStyle).toEqual({ color: 'M', opacity: 0.25 });
  });

  it('draws a dot per image, filled only for the images some frame joins', () => {
    const { points } = render([lane('a', [0, 10, 20, 30]), lane('b', [10, 20, 30])]);

    expect(points.data).toHaveLength(7);
    // the automatic window is the last 3 instants: a's image at 0' is not used
    expect(points.data[0].itemStyle?.color).toBe('M');
    expect(points.data[1].itemStyle?.color).toBe('P');
  });

  it('draws a line per frame through the images it joins', () => {
    const { lines } = render([lane('a', [0, 10]), lane('b', [0, 10])], [{ a: 10 * MIN, b: 0 }]);

    expect(lines.data).toHaveLength(1);
    expect(lines.data[0].coords).toEqual([
      [10 * MIN, 0],
      [0, 1],
    ]);
    expect(lines.data[0].target).toEqual({ kind: 'frame', index: 0 });
  });

  it('draws a short tick for a frame of a single image', () => {
    const { lines } = render([lane('a', [0]), lane('b', [0])], [{ b: 0 }]);

    expect(lines.data[0].coords).toEqual([
      [0, 0.7],
      [0, 1.3],
    ]);
  });

  it('rings the images of the frame being edited and thickens its line', () => {
    const { lines, points } = render([lane('a', [0, 10, 20]), lane('b', [0, 10, 20])], undefined, {
      active: { a: 0, b: 0 },
      selected: 2,
    });

    expect(lines.data[2].lineStyle?.width).toBe(5);
    expect(points.data[0].itemStyle?.borderColor).toBe('P');
    expect(points.data[3].itemStyle?.borderColor).toBe('P');
    expect(points.data[1].itemStyle?.borderColor).toBeUndefined();
  });

  it('adds wide invisible copies of the lines to catch clicks', () => {
    const { hits } = render([lane('a', [0, 10, 20])]);

    expect(hits.data[0].target).toEqual({ kind: 'frame', index: 0 });
    expect(hits.data[0].lineStyle).toMatchObject({ opacity: 0 });
  });

  it('targets the image a dot stands for', () => {
    const { points } = render([lane('a', [0, 10, 20])]);

    expect(points.data[2].target).toEqual({ kind: 'image', layerId: 'a', time: 20 * MIN });
  });
});

describe('lanes helpers', () => {
  it('spans every lane', () => {
    expect(lanesSpan([lane('a', [10, 20]), lane('b', [0, 15])])).toEqual({ min: 0, max: 20 * MIN });
    expect(lanesSpan([])).toBeNull();
  });

  it('compares lanes by their images', () => {
    expect(sameLanes([lane('a', [0, 10])], [lane('a', [0, 10])])).toBe(true);
    expect(sameLanes([lane('a', [0, 10])], [lane('a', [0, 20])])).toBe(false);
  });
});
