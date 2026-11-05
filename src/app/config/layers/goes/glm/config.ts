import { LayerType, LayerCategory, GLMGoesTileLayer } from '../../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../../models/layers/groups.models';
import { GLM_FED_SCALE, GLM_MFA_SCALE, GLM_TOE_SCALE } from './scales.config';
import { LAYER_NAMES } from '../../../../texts';

/**
 * Valores por defecto para capas GLM
 */
const GLM_DEFAULTS = {
  zIndexGroup: ActiveLayerGroupId.BASE,
  availablePeriods: [6, 12, 24] as const,
  type: LayerType.TILE,
  category: LayerCategory.GOES_19,
  minNativeZoom: 3,
  maxNativeZoom: 7,
  boundingBox: [
    [-60.0, -110.0],
    [-15.0, -30.0],
  ] as const,
  isForecast: false,
};

/**
 * Definición de capas GLM (Geostationary Lightning Mapper) - GOES-19
 * Solo información de UI y estado inicial
 */
export const GLM_SUBGROUP: LayerSubgroup = {
  id: 'glm',
  name: LAYER_NAMES.goesGlm.glm.name,
  description: LAYER_NAMES.goesGlm.glm.description,
  expanded: false,
  layers: [
    {
      ...GLM_DEFAULTS,
      id: 'goes19/glm/fed',
      variable: 'fed',
      scale: GLM_FED_SCALE,
      name: LAYER_NAMES.goesGlm.goes19GlmFed.name,
      description: LAYER_NAMES.goesGlm.goes19GlmFed.description,
    },
    {
      ...GLM_DEFAULTS,
      id: 'goes19/glm/toe',
      variable: 'toe',
      scale: GLM_TOE_SCALE,
      name: LAYER_NAMES.goesGlm.goes19GlmToe.name,
      description: LAYER_NAMES.goesGlm.goes19GlmToe.description,
    },
    {
      ...GLM_DEFAULTS,
      id: 'goes19/glm/mfa',
      variable: 'mfa',
      scale: GLM_MFA_SCALE,
      name: LAYER_NAMES.goesGlm.goes19GlmMfa.name,
      description: LAYER_NAMES.goesGlm.goes19GlmMfa.description,
    },
  ] as GLMGoesTileLayer[],
};
