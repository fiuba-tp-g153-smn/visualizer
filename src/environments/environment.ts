/**
 * Configuración para desarrollo
 */
export const environment = {
  production: false,
  backend: {
    baseUrl: $ENV.BACKEND_BASE_URL,
    useMockTiles: $ENV.USE_MOCK_TILES,
  },
  tiles: {
    format: $ENV.TILE_FORMAT,
  },
  ui: {
    disabledLayers: ['abi-ch2', 'radar'] as string[],
  },
  docsUrl: $ENV.DOCS_URL,
};
