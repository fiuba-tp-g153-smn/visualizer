export const GRATICULE_STEP_DEG = 5;
export const GRATICULE_MAJOR_STEP_DEG = 10;
const GRATICULE_MAX_LATITUDE = 85;

/**
 * Visual weight of a graticule line:
 * - `minor`: multiple of 5° but not of 10°
 * - `major`: multiple of 10°
 * - `notable`: reference line (Ecuador, trópicos, círculos polares, Greenwich)
 */
export type GraticuleTier = 'minor' | 'major' | 'notable';

export type GraticuleAxis = 'parallel' | 'meridian';

export interface GraticuleLine {
  readonly axis: GraticuleAxis;
  readonly value: number;
  readonly tier: GraticuleTier;
  readonly label: string;
}

/** A graticule label positioned in map-container pixels, ready to render. */
export interface GraticuleScreenLabel {
  readonly id: string;
  readonly axis: GraticuleAxis;
  readonly tier: GraticuleTier;
  readonly text: string;
  readonly offset: number;
}

export interface GraticuleViewBounds {
  readonly west: number;
  readonly east: number;
  readonly south: number;
  readonly north: number;
}

/** A meridian copy in the visible view: `lng` is unwrapped (may fall outside ±180). */
export interface GraticuleLabelPlacement {
  readonly line: GraticuleLine;
  readonly lng: number;
}

const NOTABLE_PARALLELS: ReadonlyArray<number> = [
  66.5, // Círculo Polar Ártico
  23.5, // Trópico de Cáncer
  0, // Ecuador
  -23.5, // Trópico de Capricornio
  -66.5, // Círculo Polar Antártico
];

const NOTABLE_MERIDIANS: ReadonlyArray<number> = [
  0, // Meridiano de Greenwich
];

function formatLatitude(lat: number): string {
  if (lat === 0) return '0°';
  return `${Math.abs(lat)}° ${lat < 0 ? 'S' : 'N'}`;
}

function formatLongitude(lng: number): string {
  if (lng === 0) return '0°';
  if (Math.abs(lng) === 180) return '180°';
  return `${Math.abs(lng)}° ${lng < 0 ? 'O' : 'E'}`;
}

function gridTier(value: number): GraticuleTier {
  return value % GRATICULE_MAJOR_STEP_DEG === 0 ? 'major' : 'minor';
}

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let v = from; v <= to; v += step) values.push(v);
  return values;
}

function toLine(axis: GraticuleAxis, value: number, tier: GraticuleTier): GraticuleLine {
  const label = axis === 'parallel' ? formatLatitude(value) : formatLongitude(value);
  return { axis, value, tier, label };
}

/**
 * Builds every graticule line: a regular 5° grid of parallels and meridians plus the
 * notable reference lines. Where a notable line falls on the grid (0° in both axes), only
 * the notable one is emitted.
 */
export function buildGraticuleLines(): ReadonlyArray<GraticuleLine> {
  const parallels = range(-GRATICULE_MAX_LATITUDE, GRATICULE_MAX_LATITUDE, GRATICULE_STEP_DEG);
  const meridians = range(-180, 180 - GRATICULE_STEP_DEG, GRATICULE_STEP_DEG);

  return [
    ...parallels
      .filter((lat) => !NOTABLE_PARALLELS.includes(lat))
      .map((lat) => toLine('parallel', lat, gridTier(lat))),
    ...meridians
      .filter((lng) => !NOTABLE_MERIDIANS.includes(lng))
      .map((lng) => toLine('meridian', lng, gridTier(lng))),
    ...NOTABLE_PARALLELS.map((lat) => toLine('parallel', lat, 'notable')),
    ...NOTABLE_MERIDIANS.map((lng) => toLine('meridian', lng, 'notable')),
  ];
}

export function meridianCopies(lng: number, west: number, east: number): number[] {
  const first = lng + 360 * Math.ceil((west - lng) / 360);
  return range(first, east, 360);
}

/**
 * Picks the lines to label for the current view: parallels whose latitude is in view and
 * one placement per visible meridian copy. Minor lines are left out unless `includeMinor`.
 */
export function visibleGraticuleLabels(
  lines: ReadonlyArray<GraticuleLine>,
  view: GraticuleViewBounds,
  includeMinor: boolean,
): { parallels: GraticuleLine[]; meridians: GraticuleLabelPlacement[] } {
  const labelled = includeMinor ? lines : lines.filter((l) => l.tier !== 'minor');

  const parallels = labelled.filter(
    (l) => l.axis === 'parallel' && l.value >= view.south && l.value <= view.north,
  );
  const meridians = labelled
    .filter((l) => l.axis === 'meridian')
    .flatMap((line) =>
      meridianCopies(line.value, view.west, view.east).map((lng) => ({ line, lng })),
    );

  return { parallels, meridians };
}
