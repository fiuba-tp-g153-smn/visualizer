/**
 * Configuración de estilos y comportamiento para polígonos en el mapa
 * Estos son valores ajustables que configuran el comportamiento visual y funcional
 * Para constantes literales (eventos, nombres CSS), ver constants/map-polygons.constants.ts
 */

/**
 * Estilos para polígonos en modo normal
 */
export const POLYGON_STYLE = {
  WEIGHT: 3,
  OPACITY: 0.8,
  FILL_OPACITY: 0.2,
} as const;

/**
 * Estilos para líneas guía durante el dibujo
 */
export const LINE_GUIDE_STYLE = {
  WEIGHT: 2,
  OPACITY: 0.6,
  DASH_ARRAY: '5, 5',
} as const;

/**
 * Estilos para polígonos en modo edición
 */
export const EDIT_STYLE = {
  DASH_ARRAY: '5, 5',
} as const;

/**
 * Estilos para departamentos
 */
export const DEPARTMENT_STYLE = {
  WEIGHT: 2,
  OPACITY: 0.7,
  FILL_OPACITY: 0.15,
  DASH_ARRAY: '3, 6',
  LIGHTEN_PERCENT: 30,
} as const;

/**
 * Z-index de los panes de polígonos, comparado con los panes de Leaflet (ver MAP_Z_INDEX),
 * no con los rangos de capas de layer-definitions.ts, que ordenan dentro de `tilePane`.
 * Los departamentos van por encima de los polígonos (`overlayPane`, 400) y por debajo de la
 * medición, los marcadores, los tooltips y los popups.
 */
export const Z_INDEX = {
  DEPARTMENTS: 450,
} as const;
