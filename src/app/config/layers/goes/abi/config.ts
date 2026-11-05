import { LayerType, LayerCategory, ABIGoesTileLayer } from '../../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../../models/layers/groups.models';
import { ABI_CH13_SCALE, ABI_CH2_SCALE, ABI_CH9_SCALE } from './scales.config';
import { LAYER_NAMES } from '../../../../texts';

/**
 * Valores por defecto para capas ABI
 * Sin repetir el mismo número en cada capa
 */
const ABI_DEFAULTS = {
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [6, 12, 24] as const,
  category: LayerCategory.GOES_19,
  type: LayerType.TILE,
  minNativeZoom: 3,
  maxNativeZoom: 7,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
  isForecast: false,
};

const idPrefix = 'goes19/abi';

/**
 * Definición de capas satelitales ABI (GOES-19)
 * Solo información de UI y estado inicial
 */
export const ABI_SUBGROUP: LayerSubgroup = {
  id: 'abi',
  name: LAYER_NAMES.goesAbi.abi.name,
  description: LAYER_NAMES.goesAbi.abi.description,
  expanded: true,
  layers: [
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/c02`,
      channel: 'c02',
      scale: ABI_CH2_SCALE,
      name: LAYER_NAMES.goesAbi.canal2.name,
      description: LAYER_NAMES.goesAbi.bandaVisible064M.description,
    },
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/c09`,
      channel: 'c09',
      scale: ABI_CH9_SCALE,
      name: LAYER_NAMES.goesAbi.canal9.name,
      description: LAYER_NAMES.goesAbi.bandaDeVaporDeAgua69M.description,
    },
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/c13`,
      channel: 'c13',
      scale: ABI_CH13_SCALE,
      name: LAYER_NAMES.goesAbi.canal13.name,
      description: LAYER_NAMES.goesAbi.bandaInfrarroja103M.description,
    },
  ] as ABIGoesTileLayer[],
};
