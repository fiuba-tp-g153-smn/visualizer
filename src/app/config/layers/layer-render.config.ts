import * as L from 'leaflet';

/**
 * Configuration for layer-specific rendering properties.
 *
 * This configuration defines:
 * - Default opacity for all layers
 * - Native zoom levels per layer category (determines tile resolution)
 * - Geographic bounds per layer category (defines visible area)
 */
export const LAYER_RENDERING_CONFIG = {
  /**
   * Default opacity percentage for layers (0-100).
   * Used when no specific opacity is set in layer controls.
   */
  defaultOpacity: 100,

  /**
   * Rendering configuration for GOES-19 satellite imagery.
   */
  goes: {
    /** Minimum native zoom level (tile resolution) */
    minNativeZoom: 4,
    /** Maximum native zoom level (tile resolution) */
    maxNativeZoom: 7,
    /** Geographic bounds for GOES tile coverage */
    bounds: [
      [-60.0, -110.0], // SW corner (South, West)
      [-15.0, -30.0], // NE corner (North, East)
    ] as L.LatLngBoundsExpression,
  },

  /**
   * Rendering configuration for radar imagery.
   */
  radar: {
    /** Minimum native zoom level (tile resolution) */
    minNativeZoom: 4,
    /** Maximum native zoom level (tile resolution) */
    maxNativeZoom: 10,
    /** Geographic bounds for radar coverage */
    bounds: [
      //  boundingBox: {[-66.78, -33.60, -61.60, -29.26],
      [-33.6, -66.78], // SW corner (lat, lng)
      [-29.26, -61.6], // NE corner (lat, lng)
    ] as L.LatLngBoundsExpression,
  },
} as const;
