/**
 * Base map model
 *
 * Represents a base map provider as exposed by the backend `/basemap/providers`
 * endpoint, augmented with the client-side preview tile coordinates.
 */

export interface BaseMap {
  /** Stable provider identifier returned by the backend (camelCase, URL-safe) */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Tile URL template with {z}, {x}, {y} placeholders */
  url: string;
  /** Attribution HTML, ready to feed Leaflet's attribution control */
  attribution: string;
  /** Lowest zoom the provider supports */
  minZoom: number;
  /**
   * Highest zoom we are willing to request from the backend.
   * Capped at the backend's `cache_max_zoom` so that offline mode never
   * surfaces blank tiles above the locally-available range.
   */
  maxZoom: number;
  /** Preview zoom for the selector thumbnail */
  previewZ: number;
  /** Preview X coordinate for the selector thumbnail */
  previewX: number;
  /** Preview Y coordinate for the selector thumbnail */
  previewY: number;
}
