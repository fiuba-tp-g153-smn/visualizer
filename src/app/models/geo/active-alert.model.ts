/**
 * Active alert read from the alert-service GET /alerts endpoint.
 */

/**
 * Raw active alert as returned by the backend (snake_case).
 */
export interface ActiveAlertResponse {
  /** Database ID of the alert */
  alert_id: number;
  /** Phenomenon description */
  phenomenon: string;
  /** Affected area as HTML grouped by province */
  area: string;
  /** Polygon vertices serialized as "[lat,lon],[lat,lon],..." */
  polygon: string;
  /** Start datetime (ISO-8601) */
  start_datetime: string;
  /** End datetime (ISO-8601) */
  end_datetime: string;
}

/**
 * Affected department parsed from the backend `area` HTML.
 */
export interface ActiveAlertDepartment {
  /** Department name */
  name: string;
  /** Province the department belongs to */
  province: string;
}

/**
 * Domain model for an active alert used by the frontend.
 */
export interface ActiveAlert {
  /** Database ID of the alert */
  alertId: number;
  /** Phenomenon description */
  phenomenon: string;
  /** Affected departments parsed from the backend `area` HTML, sorted by name */
  departments: ReadonlyArray<ActiveAlertDepartment>;
  /** Polygon vertices as Leaflet [lat, lng] pairs */
  coordinates: ReadonlyArray<[number, number]>;
  /** Start datetime */
  startDatetime: Date;
  /** End datetime */
  endDatetime: Date;
}
