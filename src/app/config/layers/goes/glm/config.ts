import { LayerType, LayerCategory, GLMGoesTileLayer } from '../../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../../models/layers/groups.models';
import { GLM_FED_SCALE, GLM_MFA_SCALE, GLM_TOE_SCALE } from './scales.config';

/**
 * Valores por defecto para capas GLM
 */
const GLM_DEFAULTS = {
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [1, 6, 12, 24] as const,
  type: LayerType.TILE,
  category: LayerCategory.GOES_19,
  minNativeZoom: 3,
  maxNativeZoom: 7,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
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
      id: 'goes-19/glm/glm-fed',
      variable: 'fed',
      scale: GLM_FED_SCALE,
      name: 'Flash Extent Density',
      description: 'Densidad de extensión de rayos',
    },
    {
      ...GLM_DEFAULTS,
      id: 'goes-19/glm/glm-toe',
      variable: 'toe',
      scale: GLM_TOE_SCALE,
      name: 'Total Optical Energy',
      description: 'Energía óptica total de los rayos',
    },
    {
      ...GLM_DEFAULTS,
      id: 'goes-19/glm/glm-mfa',
      variable: 'mfa',
      scale: GLM_MFA_SCALE,
      name: 'Minimum Flash Area',
      description: 'Área mínima de los rayos',
    },
  ] as GLMGoesTileLayer[],
};
