const STORAGE_PREFIX = 'mapasmn';
const STORAGE_VERSION = '2026-05-19T10:00:00Z';

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
  TIMEZONE_SETTINGS: buildStorageKey('timezone-settings'),
  POLYGONS: buildStorageKey('polygons'),
  POLYGON_SIMPLIFICATION_LEVEL: buildStorageKey('polygon-simplification-level'),
  WEATHER_STATIONS_SHARED_CONTROLS: buildStorageKey('weather-stations-shared-controls'),
  WEATHER_STATIONS_API_KEY: buildStorageKey('weather-stations-api-key'),
} as const;
