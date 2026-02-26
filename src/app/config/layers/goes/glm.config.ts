import { LayerType, LayerCategory, GoesTileLayer, GLMGoesTileLayer } from '../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../models/layers/groups.models';

/**
 * Valores por defecto para capas GLM
 */
const GLM_DEFAULTS = {
  visible: false,
  opacity: 80,
  zIndexGroup: ActiveLayerGroupId.BASE,
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
  expanded: false,
  layers: [
    {
      ...GLM_DEFAULTS,
      id: 'goes-19/glm/fed',
      variable: 'fed',
      name: 'Flash Extent Density',
      description: 'Densidad de extensión de rayos',
    },
  ] as GLMGoesTileLayer[],
};
