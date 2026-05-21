/**
 * Configuración para desarrollo
 */

// Fallback for test environment where $ENV is not injected
const envDefined = typeof $ENV !== 'undefined';
const envFallback = {
  DATA_SERVICE_BASE_URL: 'https://data.mapasmn.com',
  ALERTS_SERVICE_BASE_URL: 'http://localhost:8080',
  WEATHER_STATIONS_API_KEY: '',
  SMN_API_PROMPT_FOR_TOKEN: 'true',
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
  weatherStations: {
    // Public API key passed back to the data-service on every read request.
    // Not a true secret (browser env vars are visible); rotate via the admin
    // endpoints if leaked.
    apiKey: envDefined
      ? $ENV.WEATHER_STATIONS_API_KEY || envFallback.WEATHER_STATIONS_API_KEY
      : envFallback.WEATHER_STATIONS_API_KEY,
  },
  tiles: {
    format: envDefined ? $ENV.TILE_FORMAT || 'webp' : envFallback.TILE_FORMAT,
  },
  ui: {
    disabledLayers: [] as string[],
  },
  smnApi: {
    promptForToken: envDefined
      ? $ENV.SMN_API_PROMPT_FOR_TOKEN !== 'false'
      : envFallback.SMN_API_PROMPT_FOR_TOKEN !== 'false',
  },
  docsUrl: envDefined ? $ENV.DOCS_URL : envFallback.DOCS_URL,
};
