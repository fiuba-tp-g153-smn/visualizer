export const MAP_PANES = {
  DEPARTMENTS: 'departments',
} as const;

/**
 * Estados transitorios de un polígono. La ausencia de `status` indica un
 * borrador normal y editable.
 */
export const POLYGON_STATUS = {
  /** Generación de aviso en curso (POST enviado, esperando respuesta). */
  SUBMITTING: 'submitting',
} as const;

export type PolygonStatus = (typeof POLYGON_STATUS)[keyof typeof POLYGON_STATUS];

export const CSS_VARIABLES = {
  POLYGON_COLOR: '--polygon-color',
} as const;

export const LEAFLET_EDITABLE_EVENTS = {
  DRAWING_COMMIT: 'editable:drawing:commit',
  DRAWING_CANCEL: 'editable:drawing:cancel',
  DRAWING_CLICKED: 'editable:drawing:clicked',
  VERTEX_DRAGEND: 'editable:vertex:dragend',
  VERTEX_DELETED: 'editable:vertex:deleted',
  CONTEXT_MENU: 'contextmenu',
} as const;
