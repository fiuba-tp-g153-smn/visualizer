import { LayerGroup } from '../models';
import { environment } from '../../environments/environment';
import { ABI_SUBGROUP } from './layers/satellite/abi.layers';
import {
  IGN_WMS_LIMITS_SUBGROUP,
  IGN_WMS_GEOGRAPHIC_SUBGROUP,
  IGN_WMS_INFRASTRUCTURE_SUBGROUP,
} from './layers/map/ign-wms.layers';

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
    subgroups: [ABI_SUBGROUP],
  },
  {
    id: 'radar',
    name: 'Radar',
    description: 'Capas de radar meteorológico',
    icon: 'waves',
    expanded: false,
    subgroups: [],
  },
  {
    id: 'ign-wms',
    name: 'IGN Argentina',
    description: 'Capas WMS del Instituto Geográfico Nacional',
    icon: 'map',
    expanded: false,
    subgroups: [
      IGN_WMS_LIMITS_SUBGROUP,
      IGN_WMS_GEOGRAPHIC_SUBGROUP,
      IGN_WMS_INFRASTRUCTURE_SUBGROUP,
    ],
  },
].filter((group) => !environment.ui.disabledLayers.includes(group.id));
