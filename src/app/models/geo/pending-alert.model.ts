/**
 * Pending alert read from the alert-service GET /alerts/pending endpoint.
 *
 * Pending alerts were generated (POST /alerts) but not yet mirrored into the
 * active alerts table. They share the id-space of POST /alerts responses
 * (`IdAviso_temporal`), which is DIFFERENT from active alerts' `IdAlerta`.
 */

import { ActiveAlertDepartment } from './active-alert.model';
import { LatLng } from './coordinate.model';

/**
 * Raw pending alert as returned by the backend (snake_case). POST /alerts
 * responses are a superset of this shape.
 */
export interface PendingAlertResponse {
  /** Database ID of the pending alert (IdAviso_temporal) */
  alert_id: number;
  /** Phenomenon description */
  phenomenon: string;
  /** Affected area as HTML grouped by province */
  area: string;
  /** Polygon vertices serialized as "[lat,lon],[lat,lon],..." */
  polygon: string;
  /** Relative URL path to the full-country GIF (e.g. "/alerts/x.gif") */
  gif_gral_url: string;
  /** Relative URL path to the zoomed-area GIF */
  gif_area_url: string;
}

/**
 * Domain model for a pending alert used by the frontend.
 */
export interface PendingAlert {
  /** Database ID of the pending alert (IdAviso_temporal id-space) */
  alertId: number;
  /** Phenomenon description */
  phenomenon: string;
  /** Affected departments parsed from the backend `area` HTML, sorted by name */
  departments: ReadonlyArray<ActiveAlertDepartment>;
  /** Polygon vertices as Leaflet [lat, lng] pairs */
  coordinates: ReadonlyArray<LatLng>;
  /** Absolute URL to the full-country GIF */
  gifGralUrl: string;
  /** Absolute URL to the zoomed-area GIF */
  gifAreaUrl: string;
}
