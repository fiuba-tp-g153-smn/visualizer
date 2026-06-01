import * as L from 'leaflet';

/**
 * Color for active alert ("aviso") polygons — distinct from the red used for
 * user-drawn polygons so the two are visually separable on the map.
 */
export const AVISO_COLOR = '#8E24AA'; // Violeta

/**
 * Leaflet options for aviso polygons: read-only (not editable) but interactive
 * so a popup can be opened on click.
 */
export const AVISO_POLYGON_OPTIONS: L.PolylineOptions = {
  color: AVISO_COLOR,
  weight: 3,
  opacity: 0.85,
  fillColor: AVISO_COLOR,
  fillOpacity: 0.2,
  interactive: true,
};
