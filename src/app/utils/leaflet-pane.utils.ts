import type { Map as LeafletMap } from 'leaflet';

const LEAFLET_TILE_PANE = 'tilePane';

/**
 * Ensures a non-interactive pane named `name` exists as a child of `tilePane`
 * and sets its CSS z-index, returning it.
 *
 * Living inside `tilePane`'s stacking context lets a vector layer compete with
 * the tile layers' own z-indices (`TileLayer.setZIndex`), so it stacks in the
 * user's layer order instead of always floating above every raster.
 */
export function ensureTilePaneChild(map: LeafletMap, name: string, zIndex: number): HTMLElement {
  let pane = map.getPane(name);
  if (!pane) {
    const tilePane = map.getPane(LEAFLET_TILE_PANE);
    pane = tilePane ? map.createPane(name, tilePane) : map.createPane(name);
    pane.style.pointerEvents = 'none';
  }
  pane.style.zIndex = String(zIndex);
  return pane;
}
