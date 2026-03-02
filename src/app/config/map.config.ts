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

  // Default base map ID
  defaultBaseMapId: 'argenmap',

  // Number of next frames to pre-render in the DOM with opacity=0
  // para animaciones suaves sin flashes durante playback
  prerenderNextFrames: 2,
};
