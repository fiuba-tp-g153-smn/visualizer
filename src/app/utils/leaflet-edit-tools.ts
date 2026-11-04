/// <reference types="leaflet-editable" />
import * as L from 'leaflet';
import 'leaflet-editable';

/** `createVertexIcon` is part of leaflet-editable's runtime API but missing from its typings. */
type EditToolsWithVertexIcon = L.Editable & {
  createVertexIcon: (options: L.DivIconOptions) => L.DivIcon;
};

/**
 * Returns the map's leaflet-editable tools, creating them on first use. Shared by
 * polygon drawing and the distance tool so both get the same vertex handles.
 */
export function ensureEditTools(map: L.Map): L.Editable {
  if (!map.editTools) {
    const tools = new L.Editable(map, {}) as EditToolsWithVertexIcon;
    tools.createVertexIcon = (options) => {
      const size = L.Browser.mobile && L.Browser.touch ? 20 : 12;
      return L.divIcon({ ...options, iconSize: [size, size] });
    };
    map.editTools = tools;
  }
  return map.editTools;
}
