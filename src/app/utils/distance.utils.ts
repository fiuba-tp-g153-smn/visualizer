export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/** Mean Earth radius (IUGG), the same one Leaflet's CRS.Earth uses. */
const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in meters (haversine). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Length of each leg of a path, in meters. */
export function pathSegmentsMeters(points: readonly GeoPoint[]): number[] {
  return points.slice(1).map((point, i) => haversineMeters(points[i], point));
}

/**
 * Formats a distance for display: meters under 1 km, one decimal under 100 km,
 * whole kilometers (with thousands separator) beyond. `es-AR` decimal comma.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  const digits = km < 100 ? 1 : 0;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(km);
  return `${formatted} km`;
}
