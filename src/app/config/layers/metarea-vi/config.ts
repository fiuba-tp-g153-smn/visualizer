import { LayerCategory, LayerType, VectorLineStyle } from '../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../models/layers/groups.models';
import { LAYER_NAMES } from '../../../texts';

/**
 * Same-origin FeatureCollection with one LineString per zone, generated from
 * the SMN shapefiles by `scripts/metarea-vi/build-geojson.py` and served from
 * `public/`.
 */
export const METAREA_VI_DATA_URL = '/geo/metarea-vi.json';

/**
 * Dashed magenta, the colour nautical charts use for maritime limits. It reads
 * over both the light and the dark base maps and over the ocean basemap, and
 * does not collide with the near-black ECMWF/GFS isobars.
 *
 * The layer's opacity control is applied to its pane, not here.
 */
export const METAREA_VI_LINE_STYLE: VectorLineStyle = {
  color: '#d81b60',
  weight: 1.5,
  dashArray: '6 4',
};

export const METAREA_VI_SUBGROUP: LayerSubgroup = {
  id: 'metarea-vi-zonas',
  name: LAYER_NAMES.metareaVi.metareaViZonas.name,
  description: LAYER_NAMES.metareaVi.metareaViZonas.description,
  expanded: false,
  layers: [
    {
      id: 'metarea-vi',
      name: LAYER_NAMES.metareaVi.metareaVi.name,
      description: LAYER_NAMES.metareaVi.metareaVi.description,
      type: LayerType.VECTOR,
      category: LayerCategory.METAREA_VI,
      zIndexGroup: ActiveLayerGroupId.OVERLAY,
      dataUrl: METAREA_VI_DATA_URL,
      style: METAREA_VI_LINE_STYLE,
    },
  ],
};
