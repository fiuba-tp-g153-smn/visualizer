/**
 * Constantes literales para polígonos en el mapa
 * Estas son literales necesarias para el funcionamiento del código (nombres de eventos, propiedades CSS)
 * Para valores configurables (estilos, delays, z-index), ver config/map-polygons.config.ts
 */

/**
 * Configuración de panes del mapa
 */
export const MAP_PANES = {
  DEPARTMENTS: 'departments',
} as const;

/**
 * Nombres de propiedades CSS
 */
export const CSS_VARIABLES = {
  POLYGON_COLOR: '--polygon-color',
} as const;

/**
 * Nombres de eventos de Leaflet.Editable
 */
export const LEAFLET_EDITABLE_EVENTS = {
  DRAWING_COMMIT: 'editable:drawing:commit',
  DRAWING_CANCEL: 'editable:drawing:cancel',
  DRAWING_CLICKED: 'editable:drawing:clicked',
  VERTEX_DRAGEND: 'editable:vertex:dragend',
  VERTEX_DELETED: 'editable:vertex:deleted',
  CONTEXT_MENU: 'contextmenu',
} as const;
