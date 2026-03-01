/**
 * Configuración para producción
 */
export const environment = {
  production: true,
  backend: {
    baseUrl: $ENV.BACKEND_BASE_URL,
  },
  tiles: {
    format: $ENV.TILE_FORMAT,
  },
  ui: {
    disabledLayers: [] as string[],
  },
  docsUrl: $ENV.DOCS_URL,
};
