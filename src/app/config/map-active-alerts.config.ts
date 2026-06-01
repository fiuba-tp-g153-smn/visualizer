import * as L from 'leaflet';

/**
 * Color for active alert polygons — distinct from the red used for user-drawn
 * polygons so the two are visually separable on the map.
 */
export const ACTIVE_ALERT_COLOR = '#8E24AA'; // Violeta

/**
 * Leaflet options for active alert polygons: read-only (not editable) but
 * interactive so a popup can be opened on click.
 */
export const ACTIVE_ALERT_POLYGON_OPTIONS: L.PolylineOptions = {
  color: ACTIVE_ALERT_COLOR,
  weight: 3,
  opacity: 0.85,
  fillColor: ACTIVE_ALERT_COLOR,
  fillOpacity: 0.2,
  interactive: true,
};
