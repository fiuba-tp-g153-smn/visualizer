export enum GeoJSONGeometryType {
  POINT = 'Point',
  LINE_STRING = 'LineString',
  POLYGON = 'Polygon',
  MULTI_POINT = 'MultiPoint',
  MULTI_LINE_STRING = 'MultiLineString',
  MULTI_POLYGON = 'MultiPolygon',
  GEOMETRY_COLLECTION = 'GeometryCollection',
}

export enum GeoJSONType {
  FEATURE = 'Feature',
  FEATURE_COLLECTION = 'FeatureCollection',
}

export const POLYGON_RING_INDEX = {
  OUTER: 0,
} as const;

export const COORDINATE_INDEX = {
  FIRST: 0,
  SECOND: 1,
} as const;

export function coordinatesToGeoJSON(coordinates: Array<[number, number]>): GeoJSON.Polygon {
  const geoJsonCoords = coordinates.map(([lat, lng]) => [lng, lat]);

  const first = geoJsonCoords[COORDINATE_INDEX.FIRST];
  const last = geoJsonCoords[geoJsonCoords.length - 1];

  if (
    first[COORDINATE_INDEX.FIRST] !== last[COORDINATE_INDEX.FIRST] ||
    first[COORDINATE_INDEX.SECOND] !== last[COORDINATE_INDEX.SECOND]
  ) {
    geoJsonCoords.push(first);
  }

  return {
    type: GeoJSONGeometryType.POLYGON,
    coordinates: [geoJsonCoords],
  };
}

export function extractGeometry(
  geoJson: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry,
): GeoJSON.Geometry | null {
  switch (geoJson.type) {
    case GeoJSONType.FEATURE_COLLECTION: {
      const features = (geoJson as GeoJSON.FeatureCollection).features;
      return features.length > 0 ? features[COORDINATE_INDEX.FIRST].geometry : null;
    }
    case GeoJSONType.FEATURE:
      return (geoJson as GeoJSON.Feature).geometry;
    default:
      return geoJson as GeoJSON.Geometry;
  }
}

export function extractCoordinates(geometry: GeoJSON.Geometry): GeoJSON.Position[] {
  switch (geometry.type) {
    case GeoJSONGeometryType.POLYGON:
      return (geometry as GeoJSON.Polygon).coordinates[POLYGON_RING_INDEX.OUTER];

    case GeoJSONGeometryType.MULTI_POLYGON: {
      const polygons = (geometry as GeoJSON.MultiPolygon).coordinates;
      return polygons.reduce(
        (largest, current) =>
          current[POLYGON_RING_INDEX.OUTER].length > largest.length
            ? current[POLYGON_RING_INDEX.OUTER]
            : largest,
        polygons[COORDINATE_INDEX.FIRST][POLYGON_RING_INDEX.OUTER],
      );
    }

    default:
      console.warn('[GeoJSON Utils] Unsupported geometry type:', geometry.type);
      return [];
  }
}

export function geoJSONToCoordinates(
  geoJson: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry,
): Array<[number, number]> {
  const geometry = extractGeometry(geoJson);
  if (!geometry) return [];

  const coords = extractCoordinates(geometry);
  return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
}
