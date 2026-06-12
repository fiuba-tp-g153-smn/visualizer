import { PolylineOptions } from 'leaflet';

/**
 * Color for active alert polygons — distinct from the red used for user-drawn
 * polygons so the two are visually separable on the map.
 */
export const ACTIVE_ALERT_COLOR = '#8E24AA'; // Violeta

/**
 * Leaflet options for active alert polygons: read-only (not editable) but
 * interactive so a popup can be opened on click.
 */
export const ACTIVE_ALERT_POLYGON_OPTIONS: PolylineOptions = {
  color: ACTIVE_ALERT_COLOR,
  weight: 3,
  opacity: 0.85,
  fillColor: ACTIVE_ALERT_COLOR,
  fillOpacity: 0.2,
  interactive: true,
};

/**
 * Color for pending alert polygons — gray because pending alerts have no
 * start/end datetimes yet, so no expiry color can be derived.
 */
export const PENDING_ALERT_COLOR = '#9E9E9E';

/**
 * Leaflet options for pending alert polygons: dashed to convey the transient
 * "awaiting confirmation" state.
 */
export const PENDING_ALERT_POLYGON_OPTIONS: PolylineOptions = {
  color: PENDING_ALERT_COLOR,
  weight: 3,
  opacity: 0.85,
  dashArray: '8 6',
  fillColor: PENDING_ALERT_COLOR,
  fillOpacity: 0.15,
  interactive: true,
};
