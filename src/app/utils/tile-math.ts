import { BoundingBox } from '../models';

/**
 * Represents the inclusive tile coordinate range that covers a geographic bounding box
 * at a given zoom level, using the standard slippy map (XYZ) tile scheme.
 */
export interface TileRange {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/**
 * Converts a longitude to its tile X coordinate at the given zoom level.
 * @param lng - Longitude in degrees (-180 to 180)
 * @param z - Zoom level
 */
function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

/**
 * Converts a latitude to its tile Y coordinate at the given zoom level.
 * Uses the Web Mercator projection formula.
 * @param lat - Latitude in degrees
 * @param z - Zoom level
 */
function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z),
  );
}

/**
 * Calculates the inclusive tile coordinate range that covers the given bounding box
 * at the specified zoom level, using the standard XYZ (slippy map) tile scheme.
 *
 * Note: In XYZ tiles, Y increases southward, so the northern latitude maps to yMin
 * and the southern latitude maps to yMax.
 *
 * @param boundingBox - Geographic bounds as [[latSouth, lngWest], [latNorth, lngEast]]
 * @param zoom - Zoom level to calculate tile coordinates for
 * @returns Inclusive tile range covering the bounding box
 */
export function calcTileRange(boundingBox: BoundingBox, zoom: number): TileRange {
  const [[latS, lngW], [latN, lngE]] = boundingBox;
  return {
    xMin: lngToTileX(lngW, zoom),
    xMax: lngToTileX(lngE, zoom),
    yMin: latToTileY(latN, zoom), // north → smaller Y
    yMax: latToTileY(latS, zoom), // south → larger Y
  };
}
