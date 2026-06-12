/**
 * Tipos de acciones disponibles en el menú contextual de polígonos
 */
export enum PolygonContextMenuActionType {
  EDIT = 'edit',
  VISIBILITY = 'visibility',
  DELETE = 'delete',
  CUT = 'cut',
  UNDO_CUT = 'undoCut',
  TOGGLE_DEPARTMENTS = 'toggleDepartments',
  HIDE_DEPARTMENTS = 'hideDepartments',
  GENERATE_ALERT = 'generateAlert',
}

/**
 * Acción emitida por el menú contextual de polígonos
 */
export interface PolygonContextMenuAction {
  type: PolygonContextMenuActionType;
  polygonId: string;
}
