import { PathOptions, PolylineOptions } from 'leaflet';
import { POLYGON_STYLE, LINE_GUIDE_STYLE, DEPARTMENT_STYLE } from '../config/map-polygons.config';
import { POLYGON_COLOR } from '../config/polygon.config';

export const POLYGON_OPTIONS: PolylineOptions = {
  className: 'map-polygon',
  color: POLYGON_COLOR,
  weight: POLYGON_STYLE.WEIGHT,
  opacity: POLYGON_STYLE.OPACITY,
  fillColor: POLYGON_COLOR,
  fillOpacity: POLYGON_STYLE.FILL_OPACITY,
};

export const LINE_GUIDE_OPTIONS: PolylineOptions = {
  color: POLYGON_COLOR,
  weight: LINE_GUIDE_STYLE.WEIGHT,
  opacity: LINE_GUIDE_STYLE.OPACITY,
  dashArray: LINE_GUIDE_STYLE.DASH_ARRAY,
};

export function createDepartmentStyle(color: string): PathOptions {
  return {
    color,
    weight: DEPARTMENT_STYLE.WEIGHT,
    opacity: DEPARTMENT_STYLE.OPACITY,
    fillColor: color,
    fillOpacity: DEPARTMENT_STYLE.FILL_OPACITY,
    dashArray: DEPARTMENT_STYLE.DASH_ARRAY,
  };
}

/**
 * Parses a 3- or 6-digit hex string into `[r, g, b]`, or `null` when the input
 * is not a hex color (named colors, `rgb()`, malformed values). Callers fall
 * back to the original string so an unparseable color renders as-is instead of
 * `#NaNNaNNaN`.
 */
function parseHexColor(hex: string): readonly [number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return null;
  }
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function toHex(channels: readonly [number, number, number]): string {
  return '#' + channels.map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function lightenColor(hex: string, percent: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;

  return toHex([
    Math.min(255, Math.floor(r + (255 - r) * (percent / 100))),
    Math.min(255, Math.floor(g + (255 - g) * (percent / 100))),
    Math.min(255, Math.floor(b + (255 - b) * (percent / 100))),
  ]);
}

export function darkenColor(hex: string, percent: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;

  return toHex([
    Math.max(0, Math.floor(r * (1 - percent / 100))),
    Math.max(0, Math.floor(g * (1 - percent / 100))),
    Math.max(0, Math.floor(b * (1 - percent / 100))),
  ]);
}
