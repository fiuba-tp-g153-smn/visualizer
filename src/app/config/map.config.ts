/**
 * Configuración inicial del mapa
 */
export const MAP_CONFIG = {
  // Centro y zoom inicial
  initialCenter: {
    lat: -40,
    lng: -59,
  } as const,

  initialZoom: 4,
  minZoom: 2,
  maxZoom: 18,

  // Proveedor de tiles por defecto
  defaultTileProviderId: 'argenmap',
};
