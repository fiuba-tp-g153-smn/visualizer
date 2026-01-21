import { LayerGroup } from '../models';
import { ABI_SUBGROUP } from './layers/satellite/abi.layers';
import { GLM_SUBGROUP } from './layers/satellite/glm.layers';

/**
 * Definición de capas disponibles en el visualizador
 */
export const LAYER_DEFINITIONS: LayerGroup[] = [
  {
    id: 'satellite',
    name: 'Satélite',
    description: 'Capas satelitales GOES-16',
    icon: 'satellite_alt',
    expanded: true,
    subgroups: [ABI_SUBGROUP, GLM_SUBGROUP],
  },
  {
    id: 'radar',
    name: 'Radar',
    description: 'Capas de radar meteorológico',
    icon: 'waves',
    expanded: false,
    subgroups: [],
  },
];
