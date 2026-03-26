/**
 * Base map model
 *
 * Defines a base map (background map layer) configuration.
 * Each base map represents a different tileset source (e.g., OpenStreetMap, CartoDB, Argenmap).
 */

export interface BaseMap {
  /** Unique identifier for the provider */
  id: string;
  /** Display name shown in the UI */
  name: string;
  /** Tile URL template with {z}, {x}, {y} placeholders */
  url: string;
  /** Attribution text for the map provider */
  attribution: string;
  /** Maximum zoom level supported */
  maxZoom: number;
  /** Minimum zoom level (optional, defaults to 0) */
  minZoom?: number;
  /** Preview zoom level for thumbnail generation */
  previewZ?: number;
  /** Preview X coordinate for thumbnail generation */
  previewX?: number;
  /** Preview Y coordinate for thumbnail generation */
  previewY?: number;
}
