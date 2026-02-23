import { LayerType, LayerCategory, SatelliteTileLayer } from '../../../models';
import { ActiveLayerGroup, LayerSubgroup } from '../../../models/layers/groups.models';

/**
 * Valores por defecto para capas GLM
 */
const GLM_DEFAULTS = {
  groupId: 'satellite',
  subgroupId: 'glm',
  visible: false,
  opacity: 80,
  zIndexGroup: ActiveLayerGroup.BASE,
  availablePeriods: [1, 6, 12, 24] as const,
  category: LayerCategory.GOES_19,
  type: LayerType.TILE,
};

/**
 * Definición de capas GLM (Geostationary Lightning Mapper) - GOES-19
 * Solo información de UI y estado inicial
 */
export const GLM_SUBGROUP: LayerSubgroup = {
  id: 'glm',
  name: 'GLM',
  description: 'Geostationary Lightning Mapper',
  groupId: 'satellite',
  expanded: false,
  layers: [
    {
      ...GLM_DEFAULTS,
      id: 'glm-fed',
      groupId: 'satellite',
      subgroupId: 'glm',
      name: 'Flash Extent Density',
      description: 'Densidad de extensión de rayos',
    },
  ] as SatelliteTileLayer[],
};
