import { LayerType, LayerCategory, ABIGoesTileLayer } from '../../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../../models/layers/groups.models';
import { ABI_CH13_SCALE, ABI_CH2_SCALE, ABI_CH9_SCALE } from './scales.config';

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

const idPrefix = 'goes-19/abi';

/**
 * Definición de capas satelitales ABI (GOES-19)
 * Solo información de UI y estado inicial
 */
export const ABI_SUBGROUP: LayerSubgroup = {
  id: 'abi',
  name: 'ABI',
  description: 'Advanced Baseline Imager',
  expanded: true,
  layers: [
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/ch-2`,
      channel: 'ch-2',
      scale: ABI_CH2_SCALE,
      name: 'Canal 2',
      description: 'Banda visible (0.64 μm)',
    },
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/ch-9`,
      channel: 'ch-9',
      scale: ABI_CH9_SCALE,
      name: 'Canal 9',
      description: 'Banda de vapor de agua (6.9 μm)',
    },
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/ch-13`,
      channel: 'ch-13',
      scale: ABI_CH13_SCALE,
      name: 'Canal 13',
      description: 'Banda infrarroja (10.3 μm)',
    },
  ] as ABIGoesTileLayer[],
};
