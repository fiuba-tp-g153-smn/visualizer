/**
 * Configuración para desarrollo
 */

// Fallback for test environment where $ENV is not injected
const envDefined = typeof $ENV !== 'undefined';
const envFallback = {
  DATA_SERVICE_BASE_URL: 'https://data.mapasmn.com',
  ALERTS_SERVICE_BASE_URL: 'http://localhost:8080',
  TILE_FORMAT: 'webp',
  DOCS_URL: '',
};

export const environment = {
  production: false,
  dataService: {
    baseUrl: envDefined
      ? $ENV.DATA_SERVICE_BASE_URL || 'https://data.mapasmn.com'
      : envFallback.DATA_SERVICE_BASE_URL,
  },
  alertsService: {
    baseUrl: envDefined
      ? $ENV.ALERTS_SERVICE_BASE_URL || 'http://localhost:8080'
      : envFallback.ALERTS_SERVICE_BASE_URL,
  },
  tiles: {
    format: envDefined ? $ENV.TILE_FORMAT || 'webp' : envFallback.TILE_FORMAT,
  },
  ui: {
    disabledLayers: [] as string[],
  },
  docsUrl: envDefined ? $ENV.DOCS_URL : envFallback.DOCS_URL,
};
