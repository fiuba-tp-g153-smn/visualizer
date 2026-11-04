import type { SyncFrameSpec } from '../models';
import type { SyncFrame, SyncImage, SyncPlan } from './sync-alignment';

/** A layer's lane in the timeline chart. */
export interface SyncChartLane {
  readonly id: string;
  readonly name: string;
  readonly timestamps: readonly number[];
  /** Why a layer outside the group's timeline is shown greyed out, its images not clickable. */
  readonly note?: string;
}

/** Theme colors, resolved from CSS variables (ECharts draws on a canvas). */
export interface SyncChartColors {
  readonly primary: string;
  /** The line of a frame being edited that crosses another one. */
  readonly error: string;
  readonly muted: string;
  readonly grid: string;
  readonly text: string;
  readonly surface: string;
}

/** How the chart writes times: the axis' hour, its date at day changes, and in full. */
export interface SyncChartFormats {
  readonly time: (time: number) => string;
  readonly day: (time: number) => string;
  readonly full: (time: number) => string;
}

/** What a click on the chart targets: a frame's line (by its index) or an image. */
export type SyncChartTarget =
  { readonly kind: 'frame'; readonly index: number } | ({ readonly kind: 'image' } & SyncImage);

/** What the dialog is editing, highlighted in the chart. */
export interface SyncChartSelection {
  /** The images of the frame being edited, ringed. */
  readonly active: SyncFrameSpec | null;
  /** The index of that frame, its line drawn thicker; null while it isn't one yet. */
  readonly selected: number | null;
  /** The frame under the pointer, its line highlighted. */
  readonly hovered?: number | null;
  /** The frame the group is showing, its number stressed as it plays. */
  readonly current?: number | null;
  /** Whether the selected frame crosses another one, drawn in the error color. */
  readonly invalid?: boolean;
}

export const NO_SELECTION: SyncChartSelection = { active: null, selected: null };

/** The time span the chart shows, in ms. */
export interface SyncChartSpan {
  readonly min: number;
  readonly max: number;
}

/** The span of every lane's images, or null without images. */
export function lanesSpan(lanes: readonly SyncChartLane[]): SyncChartSpan | null {
  const times = lanes.flatMap((lane) => [lane.timestamps[0], lane.timestamps.at(-1)]);
  const known = times.filter((t): t is number => t !== undefined);
  return known.length > 0 ? { min: Math.min(...known), max: Math.max(...known) } : null;
}

/** Whether two lane lists draw the same chart, so a refresh with the same images is skipped. */
export function sameLanes(a: readonly SyncChartLane[], b: readonly SyncChartLane[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (lane, i) =>
        lane.id === b[i].id &&
        lane.name === b[i].name &&
        lane.note === b[i].note &&
        lane.timestamps.length === b[i].timestamps.length &&
        lane.timestamps.every((t, j) => t === b[i].timestamps[j]),
    )
  );
}

/**
 * Where the chart draws the lanes, in px from its edges. The left side is left free for the
 * lane names, laid out in HTML over it so each can carry a checkbox.
 */
export const SYNC_CHART_GRID = { left: 200, right: 16, top: 24, bottom: 40 } as const;

/** Width, in px, of the invisible band that catches clicks on a frame line. */
const LINE_HIT_WIDTH = 14;
/** Half the height, in lanes, of the tick drawn for a frame of a single image. */
const SINGLE_TICK = 0.3;

interface PointDatum {
  readonly value: [number, number];
  /** What a click acts on; none for the images of a greyed-out lane. */
  readonly target?: SyncChartTarget;
  readonly symbolSize: number;
  readonly itemStyle: {
    readonly color: string;
    readonly opacity: number;
    readonly borderColor?: string;
    readonly borderWidth?: number;
  };
}

interface LineDatum {
  readonly coords: [number, number][];
  readonly target: SyncChartTarget;
  readonly lineStyle: {
    readonly color: string;
    readonly width: number;
    readonly opacity?: number;
    readonly type?: 'solid' | 'dashed';
  };
}

/** How a frame's line stands out: being edited, under the pointer, or not. */
type LineEmphasis = 'selected' | 'hovered' | 'none';
const LINE_WIDTHS: Record<LineEmphasis, number> = { selected: 5, hovered: 3.5, none: 2 };

/** The image times each lane joins in some frame. */
function usedImages(lanes: readonly SyncChartLane[], plan: SyncPlan): Map<string, Set<number>> {
  const used = new Map(lanes.map((lane) => [lane.id, new Set<number>()]));
  for (const frame of plan.frames) {
    for (const lane of lanes) {
      const index = frame.members.get(lane.id);
      if (index !== undefined) used.get(lane.id)!.add(lane.timestamps[index]);
    }
  }
  return used;
}

/**
 * A frame's line through the images it joins, as segments between consecutive ones: dashed
 * where it passes over lanes the frame leaves out (those layers hold their image). A frame
 * of a single image is a short tick on its lane.
 */
function frameSegments(
  frame: SyncFrame,
  index: number,
  lanes: readonly SyncChartLane[],
  emphasis: LineEmphasis,
  color: string,
): LineDatum[] {
  const points = lanes.flatMap((lane, i): [number, number][] => {
    const member = frame.members.get(lane.id);
    return member === undefined ? [] : [[lane.timestamps[member], i]];
  });
  const target = { kind: 'frame', index } as const;
  const width = LINE_WIDTHS[emphasis];
  if (points.length === 1) {
    const [[time, lane]] = points;
    return [
      {
        coords: [
          [time, lane - SINGLE_TICK],
          [time, lane + SINGLE_TICK],
        ],
        target,
        lineStyle: { color, width },
      },
    ];
  }
  return points.slice(1).map((to, k) => {
    const from = points[k];
    const skips = to[1] - from[1] > 1;
    return {
      coords: [from, to],
      target,
      lineStyle: {
        color,
        width,
        type: skips ? 'dashed' : 'solid',
        opacity: skips ? 0.6 : 1,
      },
    };
  });
}

/** The day the chart spans, or its first and last when it spans more. */
function daysLabel(
  lanes: readonly SyncChartLane[],
  span: SyncChartSpan | null,
  formats: SyncChartFormats,
): string {
  const range = span ?? lanesSpan(lanes);
  if (!range) return '';
  const [first, last] = [formats.day(range.min), formats.day(range.max)];
  return first === last ? first : `${first} – ${last}`;
}

/**
 * ECharts option for a sync group's timeline: one lane per layer with a dot per image
 * (filled when some frame joins it) and a line per frame through the images it joins.
 * Every dot, line and frame number carries the `target` a click acts on. The axis shows
 * the hour, with the day by its start and under each midnight; tooltips always show the
 * full date and time.
 */
export function buildSyncTimelineOption(
  lanes: readonly SyncChartLane[],
  plan: SyncPlan,
  colors: SyncChartColors,
  formats: SyncChartFormats,
  selection: SyncChartSelection = NO_SELECTION,
  span: SyncChartSpan | null = null,
): Record<string, unknown> {
  const used = usedImages(lanes, plan);
  const { active, selected, hovered = null, current = null, invalid = false } = selection;
  const points: PointDatum[] = lanes.flatMap((lane, i) =>
    lane.timestamps.map((time): PointDatum => {
      if (lane.note !== undefined) {
        return {
          value: [time, i],
          symbolSize: 8,
          itemStyle: { color: colors.muted, opacity: 0.25 },
        };
      }
      const isUsed = used.get(lane.id)!.has(time);
      const isPicked = active?.[lane.id] === time;
      return {
        value: [time, i] as [number, number],
        target: { kind: 'image', layerId: lane.id, time } as const,
        symbolSize: isPicked ? 16 : 12,
        itemStyle: isPicked
          ? { color: colors.surface, opacity: 1, borderColor: colors.primary, borderWidth: 3 }
          : { color: isUsed ? colors.primary : colors.muted, opacity: isUsed ? 1 : 0.5 },
      };
    }),
  );
  const lines = plan.frames.flatMap((frame, i) =>
    frameSegments(
      frame,
      i,
      lanes,
      i === selected ? 'selected' : i === hovered ? 'hovered' : 'none',
      i === selected && invalid ? colors.error : colors.primary,
    ),
  );
  // Each frame's number above the chart, the playing one stressed; crowded ones hide.
  const numbers = plan.frames.map((frame, i) => ({
    value: [frame.time, -0.5],
    target: { kind: 'frame', index: i } as const,
    label: {
      show: true,
      position: 'top',
      formatter: String(i + 1),
      fontSize: 11,
      color: i === current ? colors.primary : colors.muted,
      fontWeight: i === current ? 'bold' : 'normal',
    },
  }));

  return {
    animation: false,
    grid: { ...SYNC_CHART_GRID, containLabel: false },
    tooltip: {
      trigger: 'item',
      // Kept inside the chart, so a long name by an edge never overflows the dialog, and
      // moved at once instead of sliding over from the last dot.
      confine: true,
      transitionDuration: 0,
      extraCssText: 'max-width: 280px; white-space: normal; overflow-wrap: anywhere;',
      formatter: (params: { data: PointDatum | LineDatum; value: [number, number] }) => {
        const target = params.data.target;
        if (!target) {
          const lane = lanes[params.value[1]];
          return `${lane.name}<br>${formats.full(params.value[0])}<br><i>${lane.note}</i>`;
        }
        if (target.kind === 'image') {
          const lane = lanes.find((l) => l.id === target.layerId);
          return `${lane?.name ?? ''}<br>${formats.full(target.time)}`;
        }
        return `Cuadro ${target.index + 1}<br>${formats.full(plan.frames[target.index].time)}`;
      },
    },
    xAxis: {
      type: 'time',
      min: span?.min,
      max: span?.max,
      axisLabel: {
        color: colors.text,
        hideOverlap: true,
        // The date under each midnight, so days never blur.
        formatter: (value: number) => {
          const time = formats.time(value);
          return time === '00:00' ? `${time}\n${formats.day(value)}` : time;
        },
      },
      // The day (or days) the chart spans, left of the axis.
      name: daysLabel(lanes, span, formats),
      nameLocation: 'start',
      nameGap: 12,
      nameTextStyle: { color: colors.text, fontWeight: 'bold', verticalAlign: 'top' },
      // At the bottom, not crossing the first lane (the lane axis has its zero there).
      axisLine: { onZero: false, lineStyle: { color: colors.grid } },
      splitLine: { show: true, lineStyle: { color: colors.grid, type: 'dashed' } },
    },
    // A value axis, not a category one, so a single image's tick can span part of a lane.
    yAxis: {
      type: 'value',
      inverse: true,
      min: -0.5,
      max: lanes.length - 0.5,
      // The lane names are HTML, beside the chart (see SYNC_CHART_GRID).
      axisLabel: { show: false },
      axisLine: { show: true, lineStyle: { color: colors.grid } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'lines',
        coordinateSystem: 'cartesian2d',
        polyline: true,
        silent: true,
        z: 1,
        data: lines,
      },
      {
        type: 'scatter',
        z: 2,
        data: points,
      },
      {
        type: 'scatter',
        z: 3,
        symbolSize: 1,
        // Drawn above the lanes, outside the grid.
        clip: false,
        // Transparent, not opacity 0, which the label would inherit.
        itemStyle: { color: 'transparent' },
        labelLayout: { hideOverlap: true },
        data: numbers,
      },
      // Invisible wide copies of the frame lines, so they are easy to click.
      {
        type: 'lines',
        coordinateSystem: 'cartesian2d',
        polyline: true,
        z: 1,
        data: lines.map((line) => ({
          ...line,
          lineStyle: { ...line.lineStyle, width: LINE_HIT_WIDTH, opacity: 0 },
        })),
      },
    ],
  };
}

/**
 * Resolves a theme CSS variable to a concrete color for the canvas. Theme tokens can be
 * `light-dark(…)` expressions the canvas can't parse, so the browser computes them on a
 * probe element.
 */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const probe = document.createElement('span');
  probe.style.color = `var(${name}, ${fallback})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || fallback;
}
