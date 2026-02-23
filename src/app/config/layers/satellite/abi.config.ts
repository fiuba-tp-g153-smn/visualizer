import { LayerType, LayerCategory, SatelliteTileLayer } from '../../../models';
import { ActiveLayerGroup, LayerSubgroup } from '../../../models/layers/groups.models';

/**
 * Valores por defecto para capas ABI
 * Sin repetir el mismo número en cada capa
 */
const ABI_DEFAULTS = {
  groupId: 'satellite',
  subgroupId: 'abi',
  zIndexGroup: ActiveLayerGroup.BASE,
  availablePeriods: [1, 6, 12, 24] as const,
  category: LayerCategory.GOES_19,
  type: LayerType.TILE,
};

/**
 * Definición de capas satelitales ABI (GOES-19)
 * Solo información de UI y estado inicial
 */
export const ABI_SUBGROUP: LayerSubgroup = {
  id: 'abi',
  name: 'ABI',
  description: 'Advanced Baseline Imager',
  groupId: 'satellite',
  expanded: true,
  layers: [
    {
      ...ABI_DEFAULTS,
      id: 'abi-ch-02',
      groupId: 'satellite',
      subgroupId: 'abi',
      name: 'Canal 2 (Visible)',
      description: 'Banda visible (0.64 μm)',
    },
    {
      ...ABI_DEFAULTS,
      id: 'abi-ch-09',
      groupId: 'satellite',
      subgroupId: 'abi',
      name: 'Canal 9 (Vapor de agua)',
      description: 'Banda de vapor de agua (6.9 μm)',
    },
    {
      ...ABI_DEFAULTS,
      id: 'abi-ch-13',
      groupId: 'satellite',
      subgroupId: 'abi',
      name: 'Canal 13 (Infrarrojo)',
      description: 'Banda infrarroja (10.3 μm)',
    },
  ] as SatelliteTileLayer[],
};
