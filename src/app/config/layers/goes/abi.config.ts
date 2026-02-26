import { LayerType, LayerCategory, ABIGoesTileLayer } from '../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../models/layers/groups.models';

/**
 * Valores por defecto para capas ABI
 * Sin repetir el mismo número en cada capa
 */
const ABI_DEFAULTS = {
  groupId: 'goes-19',
  subgroupId: 'abi',
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12, 24] as const,
  category: LayerCategory.GOES_19,
  type: LayerType.TILE,
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
      name: 'Canal 2 (Visible)',
      description: 'Banda visible (0.64 μm)',
    },
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/ch-9`,
      channel: 'ch-9',
      name: 'Canal 9 (Vapor de agua)',
      description: 'Banda de vapor de agua (6.9 μm)',
    },
    {
      ...ABI_DEFAULTS,
      id: `${idPrefix}/ch-13`,
      channel: 'ch-13',
      name: 'Canal 13 (Infrarrojo)',
      description: 'Banda infrarroja (10.3 μm)',
    },
  ] as ABIGoesTileLayer[],
};
