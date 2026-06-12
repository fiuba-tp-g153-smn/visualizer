/**
 * Color único para todos los polígonos
 */
export const POLYGON_COLOR = '#FF7F00'; // Naranja

/**
 * Nivel de detalle fijo para cargar departamentos (1-5)
 * 1 = menor detalle (mayor tolerancia de simplificación)
 * 5 = mayor detalle (menor tolerancia de simplificación)
 */
export const DEPARTMENTS_DETAIL_LEVEL = 3;

/**
 * Valor inicial de la cantidad máxima de vértices por polígono, usado hasta
 * que se obtiene el valor real desde el backend de alertas.
 */
export const DEFAULT_MAX_POLYGON_VERTICES = 650;
