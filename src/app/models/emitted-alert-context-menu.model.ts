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
  /** Phenomenon name, shown in the menu header */
  readonly phenomenon: string;
  /** Issue/expiry timestamps — only available for active alerts */
  readonly startDatetime?: Date;
  readonly endDatetime?: Date;
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
