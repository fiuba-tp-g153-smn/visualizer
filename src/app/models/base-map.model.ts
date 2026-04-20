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
   * Highest zoom at which the layer is still *displayed* on the map.
   * Past `maxNativeZoom`, Leaflet upscales the last available tile rather
   * than fetching new ones — so this can safely be the map's overall max.
   */
  maxZoom: number;
  /**
   * Highest zoom for which we actually *fetch* tiles from the backend.
   * Mirrors the backend's `cache_max_zoom` so offline mode never hits the
   * 404 zone above the locally-available range.
   */
  maxNativeZoom: number;
  /** Preview zoom for the selector thumbnail */
  previewZ: number;
  /** Preview X coordinate for the selector thumbnail */
  previewX: number;
  /** Preview Y coordinate for the selector thumbnail */
  previewY: number;
}
