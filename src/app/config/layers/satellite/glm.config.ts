import {
  LayerSubgroup,
  LayerType,
  LayerCategory,
  ActiveLayerGroup,
  TileLayer,
} from '../../../models';
import { environment } from '../../../../environments/environment';

/**
 * Valores por defecto para capas GLM
 */
const GLM_DEFAULTS = {
  visible: false,
  opacity: 80,
  zIndexGroup: ActiveLayerGroup.BASE,
  availablePeriods: [1, 6, 12, 24] as const,
  category: LayerCategory.SATELLITE_ABI,
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
      id: 'glm-fed',
      name: 'Flash Extent Density',
      description: 'Densidad de extensión de rayos',
    } as TileLayer,
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
