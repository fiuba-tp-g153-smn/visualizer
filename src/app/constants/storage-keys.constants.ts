const STORAGE_PREFIX = 'mapasmn';
const STORAGE_VERSION = '1.0.0';

function buildStorageKey(name: string): string {
  return `${STORAGE_PREFIX}.${name}@${STORAGE_VERSION}`;
}

export const STORAGE_KEYS = {
  BASE_MAP: buildStorageKey('base-map'),
  ACTIVE_LAYERS: buildStorageKey('active-layers'),
  MAP_TOOLS: buildStorageKey('map-tools'),
  POINT_QUERY_VIEWER: buildStorageKey('point-query-viewer'),
  POINT_QUERY_RESULTS: buildStorageKey('point-query-results'),
  SCALE_TOOLS: buildStorageKey('scale-tools'),
  UNITS_SETTINGS: buildStorageKey('units-settings'),
  POLYGONS: buildStorageKey('polygons'),
  POLYGON_SIMPLIFICATION_LEVEL: buildStorageKey('polygon-simplification-level'),
} as const;
