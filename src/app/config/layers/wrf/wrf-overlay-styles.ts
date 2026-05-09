import * as L from 'leaflet';
import type { Feature } from 'geojson';

import { VectorLineStyle, VectorTextpathOptions } from '../../../models';

// ============================================================================
// Color palettes — copied verbatim from `WRF/generar_wrf.py` so the visualizer
// matches the SMN reference figures.
// ============================================================================

const COLOR_BLUE_PURE = '#0000FF'; // matplotlib "blue"
const COLOR_BARB_BLACK = '#000000';

// shear_850_500 (MUCAPE) — 5 levels: 10, 20, 30, 40, 50 kt
const SHEAR_850_500_COLORS: ReadonlyArray<readonly [number, string]> = [
  [10, '#8AD0F3'],
  [20, '#41A9E0'],
  [30, '#2082B7'],
  [40, '#8377D5'],
  [50, '#37159F'],
];

// shear_850_700 (JetCapasBajas) — 3 levels: 6, 10, 14 kt
const SHEAR_850_700_COLORS: ReadonlyArray<readonly [number, string]> = [
  [6, '#54ADDE'],
  [10, '#3989B5'],
  [14, '#8274E5'],
];

// haildiammax (Granizo) — 3 levels: 0.5, 3.0, 5.0 cm
const HAIL_DIAM_COLORS: ReadonlyArray<readonly [number, string]> = [
  [0.5, '#007F00'],
  [3.0, '#0000FF'],
  [5.0, '#82D2FF'],
];

// ============================================================================
// Style helpers
// ============================================================================

function nearestColor(
  table: ReadonlyArray<readonly [number, string]>,
  value: number,
): string {
  let bestColor = table[0][1];
  let bestDiff = Infinity;
  for (const [lvl, color] of table) {
    const diff = Math.abs(value - lvl);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestColor = color;
    }
  }
  return bestColor;
}

function makeUniformStyle(color: string, weight: number): (value: number) => VectorLineStyle {
  return () => ({ color, weight, opacity: 0.95 });
}

function makeLevelStyle(
  table: ReadonlyArray<readonly [number, string]>,
  weight = 1.2,
): (value: number) => VectorLineStyle {
  return (value: number) => ({ color: nearestColor(table, value), weight, opacity: 0.95 });
}

function makeTextpath(color: string): VectorTextpathOptions {
  return {
    center: true,
    offset: -3,
    attributes: {
      fill: color,
      'font-size': '9px',
      'font-weight': 'bold',
      'font-family': 'sans-serif',
    },
  };
}

// ============================================================================
// SLP isobars (Precipitacion1h) — all blue, every contour labeled.
// Manual: `colors="blue"`, `linewidths=0.8`, `clabel(fmt="%d", colors="blue")`.
// ============================================================================

export const slpStyleFor = makeUniformStyle(COLOR_BLUE_PURE, 0.8);
export const slpLabelFor = (value: number): string => `${value.toFixed(0)}`;
export const SLP_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_BLUE_PURE);

// ============================================================================
// Gust threshold (Rafagas) — single blue contour at 35 kt.
// Manual: `colors="blue"`, `linewidths=0.7`.
// ============================================================================

export const gustThresholdStyleFor = makeUniformStyle(COLOR_BLUE_PURE, 0.7);
export const GUST_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_BLUE_PURE);

// ============================================================================
// BRN (CAPE_BRN) — all blue. Manual: `colors="blue"`, `linewidths=0.8`.
// ============================================================================

export const brnStyleFor = makeUniformStyle(COLOR_BLUE_PURE, 0.8);
export const BRN_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(COLOR_BLUE_PURE);

// ============================================================================
// shear_850_500 (MUCAPE) and shear_850_700 (JetCapasBajas) — per-level color.
// Manual: explicit color list, label color falls back to the line color.
// ============================================================================

export const shear850_500StyleFor = makeLevelStyle(SHEAR_850_500_COLORS);
export const shear850_700StyleFor = makeLevelStyle(SHEAR_850_700_COLORS);

export function shear850_500TextpathFor(value: number): VectorTextpathOptions {
  return makeTextpath(nearestColor(SHEAR_850_500_COLORS, value));
}
export function shear850_700TextpathFor(value: number): VectorTextpathOptions {
  return makeTextpath(nearestColor(SHEAR_850_700_COLORS, value));
}

// Static fallback textpath options (used by the overlay config, which expects
// a constant `VectorTextpathOptions`). Color matches the middle level.
export const SHEAR_850_500_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(
  SHEAR_850_500_COLORS[2][1],
);
export const SHEAR_850_700_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(
  SHEAR_850_700_COLORS[1][1],
);

// ============================================================================
// haildiammax (Granizo) — per-level color, "%.1f cm" labels.
// Manual: explicit color list, `clabel(fmt="%.1f cm")`.
// ============================================================================

export const haildiamStyleFor = makeLevelStyle(HAIL_DIAM_COLORS);
export const haildiamLabelFor = (value: number): string => `${value.toFixed(1)} cm`;
export const HAILDIAM_TEXTPATH_OPTIONS: VectorTextpathOptions = makeTextpath(
  HAIL_DIAM_COLORS[1][1],
);

// Plain integer labels for everything else (shear, brn, gust, slp use their own).
export const numericLabelFor = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

// ============================================================================
// Wind barbs — meteorological glyph (pennant / flag / half-flag) matching the
// SMN style. Backend emits Point features with `speed_kt`, `dir_deg`. The glyph
// is a black SVG with no per-intensity color: intensity is encoded entirely by
// the number of pennants / flags / halves.
// ============================================================================

interface BarbProperties {
  speed_kt: number;
  dir_deg: number;
}

const BARB_VIEW = 28;
const BARB_STAFF = 16;
const BARB_FLAG_LEN = 7;
const BARB_HALF_LEN = 3.5;
const BARB_PENNANT_HEIGHT = 7;
const BARB_STEP = 3.2;

/**
 * Builds a meteorological wind-barb marker.
 *
 * Convention:
 *   - `dir_deg` is the direction the wind blows FROM (meteorological).
 *   - The staff is drawn from the station along that direction (so for a
 *     northerly wind the staff extends northward on screen).
 *   - Speed is rounded to the nearest 5 kt and decomposed into pennants
 *     (50 kt), flags (10 kt) and halves (5 kt). Pennants are filled triangles,
 *     flags are full-length perpendicular ticks, halves are half-length.
 *   - Glyphs sit on the right side of the staff (matplotlib's
 *     `flip_barb=True`, used by the manual script for the southern hemisphere).
 *   - Speeds < 5 kt render as a small open circle (calm).
 */
export function buildBarbMarker(feature: Feature, latlng: L.LatLng): L.Layer {
  const props = (feature.properties ?? {}) as Partial<BarbProperties>;
  const rawSpeed = Math.max(0, props.speed_kt ?? 0);
  const dir = props.dir_deg ?? 0;
  const speed = Math.round(rawSpeed / 5) * 5;

  const html = renderBarbSvg(speed, dir);
  const icon = L.divIcon({
    className: 'wrf-wind-barb',
    html,
    iconSize: [BARB_VIEW, BARB_VIEW],
    iconAnchor: [BARB_VIEW / 2, BARB_VIEW / 2],
  });
  return L.marker(latlng, { icon, interactive: false });
}

function renderBarbSvg(speed: number, dir: number): string {
  const half = BARB_VIEW / 2;
  const open = `<svg width="${BARB_VIEW}" height="${BARB_VIEW}" viewBox="-${half} -${half} ${BARB_VIEW} ${BARB_VIEW}">`;
  const close = '</svg>';

  if (speed < 5) {
    return `${open}<circle cx="0" cy="0" r="2" fill="none" stroke="${COLOR_BARB_BLACK}" stroke-width="0.8"/>${close}`;
  }

  const theta = (dir * Math.PI) / 180;
  // Staff endpoint: in screen coords, +y is down, but meteo north is up
  // → use (sin θ, -cos θ).
  const sx = BARB_STAFF * Math.sin(theta);
  const sy = -BARB_STAFF * Math.cos(theta);
  // Left-perpendicular unit vector. SMN reference figures place pennants /
  // flags / halves on the LEFT side of the staff (looking from station toward
  // tip). Despite the manual script using `flip_barb=True`, the rendered SMN
  // PDFs show the glyphs mirrored to the left — that's the convention we
  // match here.
  const px = -Math.cos(theta);
  const py = -Math.sin(theta);

  // Position d (distance from staff origin toward tip): point on staff.
  const at = (d: number): { x: number; y: number } => ({
    x: (sx * d) / BARB_STAFF,
    y: (sy * d) / BARB_STAFF,
  });

  let pennants = Math.floor(speed / 50);
  let rest = speed - pennants * 50;
  let flags = Math.floor(rest / 10);
  let halves = Math.floor((rest - flags * 10) / 5);

  const parts: string[] = [];
  // Staff
  parts.push(
    `<line x1="0" y1="0" x2="${sx.toFixed(2)}" y2="${sy.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="0.9" stroke-linecap="round"/>`,
  );

  // Walk from the tip back toward the origin, placing pennants → flags → halves.
  let d = BARB_STAFF;

  for (let i = 0; i < pennants; i++) {
    const a = at(d);
    const b = at(d - BARB_STEP);
    const c = { x: a.x + px * BARB_PENNANT_HEIGHT, y: a.y + py * BARB_PENNANT_HEIGHT };
    parts.push(
      `<polygon points="${a.x.toFixed(2)},${a.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}" fill="${COLOR_BARB_BLACK}" stroke="${COLOR_BARB_BLACK}" stroke-width="0.5"/>`,
    );
    d -= BARB_STEP;
  }
  if (pennants > 0) d -= 1.2; // small gap after pennants

  for (let i = 0; i < flags; i++) {
    const a = at(d);
    const b = { x: a.x + px * BARB_FLAG_LEN, y: a.y + py * BARB_FLAG_LEN };
    parts.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="0.9" stroke-linecap="round"/>`,
    );
    d -= BARB_STEP;
  }

  if (halves > 0) {
    // If the only feature is a half-flag, inset it slightly from the tip so it
    // doesn't sit exactly on the endpoint (matches matplotlib's behavior).
    if (flags === 0 && pennants === 0) d = BARB_STAFF - BARB_STEP;
    const a = at(d);
    const b = { x: a.x + px * BARB_HALF_LEN, y: a.y + py * BARB_HALF_LEN };
    parts.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="0.9" stroke-linecap="round"/>`,
    );
  }

  return `${open}${parts.join('')}${close}`;
}
