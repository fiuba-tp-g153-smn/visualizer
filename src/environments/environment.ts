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
};
