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

  // Número de frames siguientes a pre-renderizar en el DOM con opacity=0
  // para animaciones suaves sin flashes durante playback
  prerenderNextFrames: 2,
};
