/**
 * Context menu for emitted (pending or active) alert polygons on the map.
 * Pending and active alerts live in different id-spaces, so every state/action
 * carries the alert kind alongside its id.
 */

export type EmittedAlertKind = 'pending' | 'active';

export interface EmittedAlertContextMenuState {
  /** Cursor position in map-container pixels */
  readonly x: number;
  readonly y: number;
  readonly kind: EmittedAlertKind;
  readonly alertId: number;
  /** Whether the alert is currently hidden by the user */
  readonly hidden: boolean;
  /** Whether this alert's departments overlay is currently shown */
  readonly departmentsShown: boolean;
  /** GIF URLs — only available for pending alerts */
  readonly gifAreaUrl?: string;
  readonly gifGralUrl?: string;
}

export type EmittedAlertContextMenuActionType =
  | 'toggleVisibility'
  | 'toggleDepartments'
  | 'viewGifArea'
  | 'viewGifGral';

export interface EmittedAlertContextMenuAction {
  readonly type: EmittedAlertContextMenuActionType;
  readonly kind: EmittedAlertKind;
  readonly alertId: number;
}
