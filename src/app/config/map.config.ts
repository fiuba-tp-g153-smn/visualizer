import * as L from 'leaflet';

/**
 * Configuración inicial del mapa
 */
export const MAP_CONFIG = {
  // Centro y zoom inicial
  initialCenter: {
    lat: -34.6037,
    lng: -58.3816,
  } as const,

  initialZoom: 4,
  minZoom: 2,
  maxZoom: 18,

  // Bounds de Argentina para tiles (formato Leaflet: [[lat_sur, lng_oeste], [lat_norte, lng_este]])
  // Usado por tiles de satélite y radar
  bounds: [
    [-60.0, -90.0], // Sur-oeste Argentina
    [-15.0, -30.0], // Norte-este Argentina
  ] as L.LatLngBoundsExpression,

  // Proveedor de tiles por defecto
  defaultTileProviderId: 'argenmap',
};
