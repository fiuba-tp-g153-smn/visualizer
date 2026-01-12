/**
 * Configuración para producción
 */
export const environment = {
  production: true,
  backend: {
    baseUrl: $ENV.BACKEND_BASE_URL,
    useMockTiles: $ENV.USE_MOCK_TILES,
  },
  tiles: {
    format: $ENV.TILE_FORMAT,
  },
};
