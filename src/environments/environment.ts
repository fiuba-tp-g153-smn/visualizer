/**
 * Configuración para desarrollo
 */

// Fallback for test environment where $ENV is not injected
const envDefined = typeof $ENV !== 'undefined';
const envFallback = {
  DATA_SERVICE_BASE_URL: 'https://data.mapasmn.com',
  ALERTS_SERVICE_BASE_URL: 'http://localhost:8080',
  SMN_API_PROMPT_FOR_TOKEN: 'true',
  DOCS_URL: '/docs-site',
  METRICS_SERVICE_BASE_URL: 'http://localhost:6020',
  IGN_PLACE_SEARCH_URL: 'https://api.ign.gob.ar/buscador/search',
  NOMINATIM_SEARCH_URL: 'https://nominatim.openstreetmap.org/search',
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
  ui: {
    disabledLayers: [] as string[],
  },
  smnApi: {
    promptForToken: envDefined
      ? $ENV.SMN_API_PROMPT_FOR_TOKEN !== 'false'
      : envFallback.SMN_API_PROMPT_FOR_TOKEN !== 'false',
  },
  docsUrl: envDefined ? $ENV.DOCS_URL || envFallback.DOCS_URL : envFallback.DOCS_URL,
  metricsService: {
    // tiles-processor backoffice metrics API (consumed by the dashboard page).
    baseUrl: envDefined
      ? $ENV.METRICS_SERVICE_BASE_URL || envFallback.METRICS_SERVICE_BASE_URL
      : envFallback.METRICS_SERVICE_BASE_URL,
  },
  placeSearch: {
    // Experimental place-search providers: IGN gazetteer and Nominatim/OSM.
    ignUrl: envDefined
      ? $ENV.IGN_PLACE_SEARCH_URL || envFallback.IGN_PLACE_SEARCH_URL
      : envFallback.IGN_PLACE_SEARCH_URL,
    nominatimUrl: envDefined
      ? $ENV.NOMINATIM_SEARCH_URL || envFallback.NOMINATIM_SEARCH_URL
      : envFallback.NOMINATIM_SEARCH_URL,
  },
};
