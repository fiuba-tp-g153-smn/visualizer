import { VectorLineStyle, VectorTextpathOptions } from '../../../models';

// ============================================================================
// Color palettes — copied verbatim from `WRF/generar_wrf.py` so the visualizer
// matches the SMN reference figures.
// ============================================================================

const COLOR_BLUE_PURE = '#0000FF'; // matplotlib "blue"

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
