import { ActiveLayerGroupId, EcmwfTpTileLayer, LayerCategory, LayerType } from '../../../models';
import { LayerSubgroup } from '../../../models/layers/groups.models';
import { buildEcmwfMslpGeojsonUrl, buildEcmwfMslpPointQueryUrl } from '../../backend.config';
import { ECMWF_TP_SCALE } from './scales.config';
import { ISOBAR_TEXTPATH_OPTIONS, isobarLabelFor, isobarStyleFor } from './mslp-isobar-style';

/**
 * Default values for the ECMWF Total Precipitation layer.
 */
const ECMWF_TP_DEFAULTS = {
  type: LayerType.TILE,
  category: LayerCategory.ECMWF_TP,
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12, 24, 47] as const,
  minNativeZoom: 3,
  maxNativeZoom: 7,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
  isForecast: true,
} as const;

export const ECMWF_SUBGROUP: LayerSubgroup = {
  id: 'ecmwf',
  name: 'ECMWF',
  description: 'Modelo numérico europeo (ECMWF)',
  expanded: true,
  layers: [
    {
      ...ECMWF_TP_DEFAULTS,
      id: 'ecmwf/total-precipitation',
      variable: 'total-precipitation',
      name: 'Precipitación Total',
      description:
        'Precipitación total acumulada en las 6 horas previas — modelo ECMWF',
      scale: ECMWF_TP_SCALE,
      // MSLP isobars are rendered as a secondary vector overlay over TP raster.
      // Always tied to TP visually: same toggle, same timeline, same forecast run.
      secondaryRender: {
        id: 'ecmwf-mslp-isobars',
        buildUrl: buildEcmwfMslpGeojsonUrl,
        buildPointQueryUrl: buildEcmwfMslpPointQueryUrl,
        valueProperty: 'pressure_hpa',
        styleFor: isobarStyleFor,
        labelFor: isobarLabelFor,
        textpathOptions: ISOBAR_TEXTPATH_OPTIONS,
        prefetchWindow: 4,
      },
    },
  ] as EcmwfTpTileLayer[],
};
