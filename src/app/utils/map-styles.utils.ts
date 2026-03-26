import * as L from 'leaflet';
import { POLYGON_STYLE, LINE_GUIDE_STYLE, DEPARTMENT_STYLE } from '../config/map-polygons.config';
import { POLYGON_COLOR } from '../config/polygon.config';

/**
 * Opciones de estilo para polígonos
 */
export const POLYGON_OPTIONS: L.PolylineOptions = {
  color: POLYGON_COLOR,
  weight: POLYGON_STYLE.WEIGHT,
  opacity: POLYGON_STYLE.OPACITY,
  fillColor: POLYGON_COLOR,
  fillOpacity: POLYGON_STYLE.FILL_OPACITY,
};

/**
 * Opciones de estilo para líneas guía
 */
export const LINE_GUIDE_OPTIONS: L.PolylineOptions = {
  color: POLYGON_COLOR,
  weight: LINE_GUIDE_STYLE.WEIGHT,
  opacity: LINE_GUIDE_STYLE.OPACITY,
  dashArray: LINE_GUIDE_STYLE.DASH_ARRAY,
};

/**
 * Genera las opciones de estilo para departamentos
 */
export function createDepartmentStyle(color: string): L.PathOptions {
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
 * Aclara un color hexadecimal por un porcentaje dado
 */
export function lightenColor(hex: string, percent: number): string {
  const color = hex.replace('#', '');

  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  const newR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  const newG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  const newB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

  return '#' + [newR, newG, newB].map((x) => x.toString(16).padStart(2, '0')).join('');
}
