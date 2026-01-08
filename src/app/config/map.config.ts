/**
 * Configuración inicial del mapa
 */
export const MAP_CONFIG = {
  // Centro y zoom inicial
  initialCenter: {
    lat: -40.0,
    lng: -64.0,
  } as const,

  initialZoom: 4,
  minZoom: 2,
  maxZoom: 18,

  // Bounds de Argentina (para limitar el área visible si es necesario)
  argentinaBounds: {
    north: -21.0,
    south: -55.0,
    east: -53.0,
    west: -74.0,
  } as const,

  // Proveedor de tiles por defecto
  defaultTileProviderId: 'argenmap',
} as const;
