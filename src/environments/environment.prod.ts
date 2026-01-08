/**
 * Configuración para producción
 */
export const environment = {
  production: true,
  backend: {
    baseUrl: 'https://api.smn.gob.ar', // URL de producción
    useMockTiles: false,
  },
  tiles: {
    format: 'webp',
  },
};
