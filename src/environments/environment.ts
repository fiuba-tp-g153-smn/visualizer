/**
 * Configuración para desarrollo
 */
export const environment = {
  production: false,
  dataService: {
    baseUrl: $ENV.DATA_SERVICE_BASE_URL || 'https://data.mapasmn.com',
  },
  alertsService: {
    baseUrl: $ENV.ALERTS_SERVICE_BASE_URL || 'http://localhost:8080',
  },
  tiles: {
    format: $ENV.TILE_FORMAT || 'webp',
  },
  ui: {
    disabledLayers: [] as string[],
  },
  docsUrl: $ENV.DOCS_URL,
};
