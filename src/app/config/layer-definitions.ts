import { LayerGroup } from '../models';
import { ABI_SUBGROUP } from './layers/satellite-abi.layers';

/**
 * Definición de capas disponibles en el visualizador
 */
export const LAYER_DEFINITIONS: LayerGroup[] = [
  {
    id: 'satellite',
    name: 'Satélite',
    description: 'Capas satelitales GOES-16',
    expanded: true,
    subgroups: [ABI_SUBGROUP],
  },
];
