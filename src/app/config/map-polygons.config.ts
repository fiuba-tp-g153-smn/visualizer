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
 * Z-index para diferentes capas
 * Los departamentos son capas de referencia (OVERLAY) que deben mostrarse por encima de los polígonos.
 * Rango OVERLAY: 1001-2000 (según layer-definitions.ts)
 */
export const Z_INDEX = {
  DEPARTMENTS: 1500,
} as const;
