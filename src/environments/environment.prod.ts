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
  // DEPRECATED: kept until Phase G deletes SmnStationsAuthService + dialog.
  smnApi: {
    baseUrl: $ENV.DATA_SERVICE_BASE_URL,
    promptForToken: $ENV.SMN_API_PROMPT_FOR_TOKEN === 'true',
  },
  weatherStations: {
    apiKey: $ENV.WEATHER_STATIONS_API_KEY,
  },
  tiles: {
    format: $ENV.TILE_FORMAT,
  },
  ui: {
    disabledLayers: [] as string[],
  },
  docsUrl: $ENV.DOCS_URL,
};
