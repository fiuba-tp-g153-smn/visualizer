/**
 * Tipos de geometrías GeoJSON soportadas
 */
export enum GeoJSONGeometryType {
  POINT = 'Point',
  LINE_STRING = 'LineString',
  POLYGON = 'Polygon',
  MULTI_POINT = 'MultiPoint',
  MULTI_LINE_STRING = 'MultiLineString',
  MULTI_POLYGON = 'MultiPolygon',
  GEOMETRY_COLLECTION = 'GeometryCollection',
}

/**
 * Tipos de objetos GeoJSON
 */
export enum GeoJSONType {
  FEATURE = 'Feature',
  FEATURE_COLLECTION = 'FeatureCollection',
}

/**
 * Índices para acceder a anillos de polígonos
 */
export const POLYGON_RING_INDEX = {
  OUTER: 0,
} as const;

/**
 * Índices para coordenadas [lat, lng] o [lng, lat]
 */
export const COORDINATE_INDEX = {
  FIRST: 0,
  SECOND: 1,
} as const;

/**
 * Convierte coordenadas de polígono a formato GeoJSON
 * Las coordenadas de Leaflet vienen como [lat, lng], pero GeoJSON usa [lng, lat]
 */
export function coordinatesToGeoJSON(coordinates: Array<[number, number]>): GeoJSON.Polygon {
  // Convertir de [lat, lng] a [lng, lat]
  const geoJsonCoords = coordinates.map(([lat, lng]) => [lng, lat]);

  // Cerrar el anillo si no está cerrado
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

/**
 * Extrae la geometría de un GeoJSON (FeatureCollection, Feature o Geometry)
 */
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

/**
 * Extrae las coordenadas principales de una geometría (Polygon o MultiPolygon)
 */
export function extractCoordinates(geometry: GeoJSON.Geometry): GeoJSON.Position[] {
  switch (geometry.type) {
    case GeoJSONGeometryType.POLYGON:
      return (geometry as GeoJSON.Polygon).coordinates[POLYGON_RING_INDEX.OUTER];

    case GeoJSONGeometryType.MULTI_POLYGON: {
      const polygons = (geometry as GeoJSON.MultiPolygon).coordinates;
      // Retornar el polígono más grande por número de coordenadas
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

/**
 * Convierte GeoJSON a coordenadas de Leaflet [lat, lng][]
 */
export function geoJSONToCoordinates(
  geoJson: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry,
): Array<[number, number]> {
  const geometry = extractGeometry(geoJson);
  if (!geometry) return [];

  const coords = extractCoordinates(geometry);

  // Convertir de [lng, lat] a [lat, lng]
  return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
}
