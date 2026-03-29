import { ActiveLayerGroupId, EcmwfTileLayer, LayerCategory, LayerType } from '../../../models';
import { LayerSubgroup } from '../../../models/layers/groups.models';

/**
 * Valores por defecto para capas ECMWF
 */
const ECMWF_DEFAULTS = {
  type: LayerType.TILE,
  category: LayerCategory.ECMWF,
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12, 24, 48] as const,
  minNativeZoom: 3,
  maxNativeZoom: 7,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
} as const;

export const ECMWF_SUBGROUP: LayerSubgroup = {
  id: 'ecmwf',
  name: 'ECMWF',
  description: 'Modelo numérico europeo (ECMWF)',
  expanded: true,
  layers: [
    {
      ...ECMWF_DEFAULTS,
      id: 'ecmwf/total-precipitation',
      variable: 'total-precipitation',
      name: 'Precipitación Total',
      description: 'Precipitación total acumulada por período de 3 horas — modelo ECMWF',
    },
  ] as EcmwfTileLayer[],
};
