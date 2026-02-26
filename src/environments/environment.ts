/**
 * Configuración para desarrollo
 */
export const environment = {
  production: false,
  backend: {
    baseUrl: $ENV.BACKEND_BASE_URL || 'https://data.mapasmn.com',
  },
  tiles: {
    format: $ENV.TILE_FORMAT || 'webp',
  },
  ui: {
    disabledLayers: [] as string[],
  },
  docsUrl: $ENV.DOCS_URL,
};
