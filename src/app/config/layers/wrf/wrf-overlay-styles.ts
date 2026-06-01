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

export const gustThresholdStyleFor = makeUniformStyle(COLOR_BLUE_PURE, 1.5);
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

const BARB_STAFF = 16;
const BARB_FLAG_LEN = 7;
const BARB_HALF_LEN = 3.5;
const BARB_PENNANT_HEIGHT = 7;
const BARB_STEP = 3.2;

/**
 * Genera markup SVG de UN barb (sin `<svg>` wrapper) posicionado en (cx, cy).
 * Pensado para componer múltiples glyphs dentro de un mismo `<svg>` por tile.
 *
 * Convención SMN hemisferio sur: pennants / flags / halves a la IZQUIERDA del
 * staff (mirando desde station hacia la punta).
 */
export function renderBarbGlyphMarkup(
  speed_kt: number,
  dir_deg: number,
  cx: number,
  cy: number,
  scale = 1,
): string {
  const staff = BARB_STAFF * scale;
  const flagLen = BARB_FLAG_LEN * scale;
  const halfLen = BARB_HALF_LEN * scale;
  const pennantH = BARB_PENNANT_HEIGHT * scale;
  const step = BARB_STEP * scale;
  const gap = 1.2 * scale;
  const sw = Math.max(0.5, 0.9 * Math.sqrt(scale));

  const speed = Math.round(Math.max(0, speed_kt) / 5) * 5;

  if (speed < 5) {
    const r = (2 * scale).toFixed(2);
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="none" stroke="${COLOR_BARB_BLACK}" stroke-width="${(0.8 * Math.sqrt(scale)).toFixed(2)}"/>`;
  }

  const theta = (dir_deg * Math.PI) / 180;
  const sx = staff * Math.sin(theta);
  const sy = -staff * Math.cos(theta);
  const px = -Math.cos(theta);
  const py = -Math.sin(theta);

  const at = (d: number): { x: number; y: number } => ({
    x: cx + (sx * d) / staff,
    y: cy + (sy * d) / staff,
  });

  const pennants = Math.floor(speed / 50);
  const rest = speed - pennants * 50;
  const flags = Math.floor(rest / 10);
  const halves = Math.floor((rest - flags * 10) / 5);

  const parts: string[] = [];
  parts.push(
    `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx + sx).toFixed(2)}" y2="${(cy + sy).toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
  );

  let d = staff;
  for (let i = 0; i < pennants; i++) {
    const a = at(d);
    const b = at(d - step);
    const c = { x: a.x + px * pennantH, y: a.y + py * pennantH };
    parts.push(
      `<polygon points="${a.x.toFixed(2)},${a.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}" fill="${COLOR_BARB_BLACK}" stroke="${COLOR_BARB_BLACK}" stroke-width="${(0.5 * scale).toFixed(2)}"/>`,
    );
    d -= step;
  }
  if (pennants > 0) d -= gap;

  for (let i = 0; i < flags; i++) {
    const a = at(d);
    const b = { x: a.x + px * flagLen, y: a.y + py * flagLen };
    parts.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
    );
    d -= step;
  }

  if (halves > 0) {
    if (flags === 0 && pennants === 0) d = staff - step;
    const a = at(d);
    const b = { x: a.x + px * halfLen, y: a.y + py * halfLen };
    parts.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
    );
  }

  return parts.join('');
}
