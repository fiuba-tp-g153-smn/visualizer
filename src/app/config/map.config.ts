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

  /**
   * Wheel pixels per zoom level. Leaflet's default (60) turns one notch into ~1.1–1.3
   * levels on Chrome/Linux (it divides wheel pixels by devicePixelRatio only, so a notch
   * arrives as ~100–120 px), and whole-level snapping rounds that up to 2. At 120 a
   * notch of up to ~180 px is one level on every platform; fast flicks still add up.
   */
  wheelPxPerZoomLevel: 120,

  maxBounds: [
    [-MAX_PANNABLE_LATITUDE, CENTER_LONGITUDE - PANNABLE_LONGITUDE_RADIUS],
    [MAX_PANNABLE_LATITUDE, CENTER_LONGITUDE + PANNABLE_LONGITUDE_RADIUS],
  ] as LatLngBoundsLiteral,
  maxBoundsViscosity: 1.0,

  // Default base map ID
  defaultBaseMapId: 'argenmap',

  // Number of next frames to pre-render in the DOM with opacity=0
  // para animaciones suaves sin flashes durante playback.
  //
  // This also sets how long a frame survives after being displayed. Frames
  // outside the window are torn off the map, and Leaflet's _removeTile points
  // each <img> at an empty data URI — which cancels any request still in
  // flight, so that tile never reaches the browser cache and is genuinely
  // re-downloaded on the next loop. A wider window gives tiles more ticks to
  // finish before teardown, at the cost of (1 + N) frames of tiles held in the
  // DOM per layer.
  prerenderNextFrames: 4,

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
