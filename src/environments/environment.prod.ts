/**
 * Configuración para producción
 */
export const environment = {
  production: true,
  dataService: {
    baseUrl: $ENV.DATA_SERVICE_BASE_URL,
  },
  alertsService: {
    baseUrl: $ENV.ALERTS_SERVICE_BASE_URL,
  },
  weatherStations: {
    apiKey: $ENV.WEATHER_STATIONS_API_KEY,
  },
  ui: {
    disabledLayers: [] as string[],
  },
  smnApi: {
    promptForToken: $ENV.SMN_API_PROMPT_FOR_TOKEN !== 'false',
  },
  docsUrl: $ENV.DOCS_URL,
  metricsService: {
    baseUrl: $ENV.METRICS_SERVICE_BASE_URL,
  },
  placeSearch: {
    ignUrl: $ENV.IGN_PLACE_SEARCH_URL,
    nominatimUrl: $ENV.NOMINATIM_SEARCH_URL,
  },
};
