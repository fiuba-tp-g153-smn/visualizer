export const MAP_PANES = {
  DEPARTMENTS: 'departments',
} as const;

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
