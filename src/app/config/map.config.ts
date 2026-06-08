import { LatLngBoundsLiteral } from 'leaflet';

const CENTER_LATITUDE = -40;
const CENTER_LONGITUDE = -59;

/** Web Mercator's projectable limit — past this lies empty space beyond Antarctica/the North Pole. */
const MAX_PANNABLE_LATITUDE = 85;

/** Two world-copies on each side of CENTER_LONGITUDE, so the wrap seam stays out in the Pacific. */
const PANNABLE_LONGITUDE_RADIUS = 2 * 360;

/**
 * Configuración inicial del mapa
 */
export const MAP_CONFIG = {
  initialCenter: {
    lat: CENTER_LATITUDE,
    lng: CENTER_LONGITUDE,
  } as const,

  initialZoom: 4,
  minZoom: 2,
  maxZoom: 18,

  maxBounds: [
    [-MAX_PANNABLE_LATITUDE, CENTER_LONGITUDE - PANNABLE_LONGITUDE_RADIUS],
    [MAX_PANNABLE_LATITUDE, CENTER_LONGITUDE + PANNABLE_LONGITUDE_RADIUS],
  ] as LatLngBoundsLiteral,
  maxBoundsViscosity: 1.0,

  // Default base map ID
  defaultBaseMapId: 'argenmap',

  // Number of next frames to pre-render in the DOM with opacity=0
  // para animaciones suaves sin flashes durante playback
  prerenderNextFrames: 2,

  // Default tool visibility
  defaultShowCoordinates: false,
  defaultShowAttribution: true,
  defaultShowScale: false,
  defaultShowZoom: true,
} as const;

/**
 * Z-index para elementos del mapa
 *
 * Leaflet panes por defecto:
 * - tilePane: 200 (tiles del mapa base)
 * - overlayPane: 400 (vectores y overlays por defecto)
 * - shadowPane: 500 (sombras de markers)
 * - markerPane: 600 (markers)
 * - tooltipPane: 650 (tooltips)
 * - popupPane: 700 (popups)
 */
export const MAP_Z_INDEX = {
  /** Z-index para el mapa base (debe ser el más bajo) */
  BASE_MAP: 0,

  /** Z-index para gratículas (líneas de lat/lon) - por encima de capas de datos */
  GRATICULE: 650,

  /** Z-index para líneas del cursor (crosshair) */
  CURSOR_LINES: 650,

  /** Z-index para el marcador de consulta puntual */
  QUERY_MARKER: 600,
} as const;
