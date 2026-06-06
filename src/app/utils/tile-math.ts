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

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z),
  );
}

export function calcTileRange(boundingBox: BoundingBox, zoom: number): TileRange {
  const [[latS, lngW], [latN, lngE]] = boundingBox;
  return {
    xMin: lngToTileX(lngW, zoom),
    xMax: lngToTileX(lngE, zoom),
    yMin: latToTileY(latN, zoom), // north → smaller Y
    yMax: latToTileY(latS, zoom), // south → larger Y
  };
}
