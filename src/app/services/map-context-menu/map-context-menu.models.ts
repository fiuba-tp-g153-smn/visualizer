/** Where on the map the menu was requested. */
export interface MapContextMenuContext {
  readonly lat: number;
  readonly lng: number;
}

export interface MapContextMenuItem {
  /** Stable id, also used for the item's `data-testid`. */
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly run: () => void;
}

export interface MapContextMenuSection {
  readonly items: readonly MapContextMenuItem[];
  /**
   * When true, the menu shows only this section. A feature in the middle of an
   * interaction (e.g. measuring) uses it to keep unrelated actions out of the way;
   * an exclusive section with no items keeps the menu closed.
   */
  readonly exclusive?: boolean;
}

/** Contributes a section for the clicked point, or `null` to contribute nothing. */
export type MapContextMenuProvider = (
  context: MapContextMenuContext,
) => MapContextMenuSection | null;

/** Screen position (map-container pixels) and the sections to render, in order. */
export interface MapContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly sections: readonly MapContextMenuSection[];
}
