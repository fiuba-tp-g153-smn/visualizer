/**
 * Configuración para desarrollo
 */
export const environment = {
  production: false,
  backend: {
    baseUrl: 'http://localhost:5000',
    useMockTiles: true, // Cambiar a false cuando el backend esté listo
  },
  tiles: {
    format: 'webp', // webp o png
  },
};
