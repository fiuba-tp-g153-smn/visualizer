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
  ui: {
    disabledLayers: ['abi-ch2', 'abi-ch9', 'radar', 'glm-ch2', 'glm-ch9', 'glm-ch13'],
  },
};
