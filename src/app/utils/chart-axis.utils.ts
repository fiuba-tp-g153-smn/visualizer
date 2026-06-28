/**
 * "Nice" linear Y-axis bounds for the weather-station charts. Snaps the data range
 * to round step boundaries with a fixed tick count so ApexCharts renders clean
 * reference labels (e.g. 0 / 2 / 4 / 6) instead of the fractional values it derives
 * from a tight, padded range.
 *
 * The tick labels are intentionally decoupled from the global decimal-precision
 * setting (the current value and tooltips keep that precision); references are
 * whole numbers, or 0.5-granularity for wind in knots.
 */

export interface NiceAxis {
  min: number;
  max: number;
  /** ApexCharts interval count — it renders `tickAmount + 1` labels. */
  tickAmount: number;
  /** The chosen gridline spacing; feed it to `axisTickFormatter`. */
  step: number;
}

export interface NiceAxisOptions {
  /** Smallest allowed gridline step: 1 for whole-number axes, 0.5 for wind-in-knots. */
  minStep: number;
  /** Pin the bottom of the axis at 0 (e.g. visibility, which is never negative). */
  floorAtZero?: boolean;
  /** Max interval count; the step ladder picks the smallest step achieving `<=` this. */
  maxTicks?: number;
}

/** `[1,2,5]×10ⁿ` → 1,2,5,10,20,50,… — clean whole-number gridlines. */
const WHOLE_LADDER = [1, 2, 5] as const;
/** `[0.5,1,2.5]×10ⁿ` → 0.5,1,2.5,5,10,25,… — keeps small knots ranges on a `.5` grid. */
const HALF_LADDER = [0.5, 1, 2.5] as const;

/** 0.5 steps need one decimal; every other (integer) step is whole. */
function decimalsForStep(step: number): number {
  return Number.isInteger(step) ? 0 : 1;
}

/** Candidate steps `>= minStep`, ascending. */
function stepCandidates(minStep: number): number[] {
  const ladder = minStep === 0.5 ? HALF_LADDER : WHOLE_LADDER;
  const steps: number[] = [];
  for (let pow = 0; pow <= 9; pow++) {
    const scale = 10 ** pow;
    for (const m of ladder) {
      const step = m * scale;
      if (step >= minStep) {
        steps.push(step);
      }
    }
  }
  return steps;
}

/** The smallest nice step whose interval count fits within `maxTicks`. */
function chooseStep(span: number, minStep: number, maxTicks: number): number {
  const candidates = stepCandidates(minStep);
  for (const step of candidates) {
    if (Math.ceil(span / step) <= maxTicks) {
      return step;
    }
  }
  return candidates[candidates.length - 1];
}

/**
 * Compute snapped axis bounds for `ys`. Returns `undefined` when there is no data,
 * so the caller can leave the axis auto-scaled (matching the empty-series branch).
 */
export function niceAxis(ys: readonly number[], opts: NiceAxisOptions): NiceAxis | undefined {
  if (!ys.length) {
    return undefined;
  }
  const { minStep, floorAtZero = false, maxTicks = 6 } = opts;

  let lo = floorAtZero ? 0 : Math.min(...ys);
  let hi = Math.max(...ys);
  if (floorAtZero) {
    lo = Math.min(0, lo); // defensive — data is non-negative
  }

  // Flat / single-point data: open a band so the axis isn't zero-height.
  if (hi - lo < 1e-9) {
    const pad = Math.max(minStep, Math.abs(hi) * 0.01);
    hi += pad;
    if (!floorAtZero) {
      lo -= pad;
    }
  }

  const step = chooseStep(hi - lo, minStep, maxTicks);
  const min = floorAtZero ? 0 : Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (max <= min) {
    max = min + step;
  }

  const dp = decimalsForStep(step);
  const round = (value: number): number => Number(value.toFixed(dp));
  return {
    min: round(min),
    max: round(max),
    tickAmount: Math.max(1, Math.round((max - min) / step)),
    step,
  };
}

/**
 * A label formatter for a nice axis: formats each tick at the step's natural
 * precision (whole numbers, or one decimal for a 0.5 step) and trims a trailing
 * `.0` so `3.0 → "3"` while `2.5` stays. Re-snaps defensively to absorb any
 * floating-point drift in the tick position ApexCharts passes in.
 */
export function axisTickFormatter(step: number): (val: number) => string {
  const dp = decimalsForStep(step);
  return (val: number) => {
    if (val === null || val === undefined || Number.isNaN(val)) {
      return '';
    }
    const snapped = Math.round(val / step) * step;
    const text = snapped.toFixed(dp);
    return dp > 0 ? text.replace(/\.0$/, '') : text;
  };
}
