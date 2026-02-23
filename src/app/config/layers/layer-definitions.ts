import { ABI_SUBGROUP } from './satellite/abi.config';
import { GLM_SUBGROUP } from './satellite/glm.config';
import { RADAR_SUBGROUPS } from './radar/config';
import {
  IGN_WMS_ADMINISTRATIVE_SUBGROUP,
  IGN_WMS_DEFENSE_SECURITY_SUBGROUP,
  IGN_WMS_GEODESY_SUBGROUP,
  IGN_WMS_GEOGRAPHIC_FEATURES_SUBGROUP,
  IGN_WMS_HYDROGRAPHY_SUBGROUP,
  IGN_WMS_INFRASTRUCTURE_SUBGROUP,
  IGN_WMS_LIMITS_SUBGROUP,
  IGN_WMS_MARITIME_SUBGROUP,
  IGN_WMS_OTHER_SUBGROUP,
  IGN_WMS_RELIEF_SUBGROUP,
  IGN_WMS_TERRITORIAL_SUBGROUP,
  IGN_WMS_VEGETATION_SUBGROUP,
} from './ign/ign-wms.config';
import { LayerGroup } from '../../models/layers/groups.models';

/**
 * Definición de capas disponibles en el visualizador
 */
export const LAYER_DEFINITIONS: LayerGroup[] = [
  {
    id: 'satellite',
    name: 'Satélite',
    description: 'Capas satelitales GOES-19',
    icon: 'satellite_alt',
    expanded: false,
    subgroups: [ABI_SUBGROUP, GLM_SUBGROUP],
  },
  {
    id: 'radar',
    name: 'Radar',
    description: 'Capas de radar meteorológico',
    icon: 'waves',
    expanded: false,
    subgroups: RADAR_SUBGROUPS,
  },
  {
    id: 'ign-wms',
    name: 'IGN Argentina',
    description: 'Capas WMS del Instituto Geográfico Nacional',
    icon: 'map',
    expanded: false,
    subgroups: [
      IGN_WMS_LIMITS_SUBGROUP,
      IGN_WMS_ADMINISTRATIVE_SUBGROUP,
      IGN_WMS_TERRITORIAL_SUBGROUP,
      IGN_WMS_GEOGRAPHIC_FEATURES_SUBGROUP,
      IGN_WMS_INFRASTRUCTURE_SUBGROUP,
      IGN_WMS_HYDROGRAPHY_SUBGROUP,
      IGN_WMS_MARITIME_SUBGROUP,
      IGN_WMS_GEODESY_SUBGROUP,
      IGN_WMS_DEFENSE_SECURITY_SUBGROUP,
      IGN_WMS_RELIEF_SUBGROUP,
      IGN_WMS_VEGETATION_SUBGROUP,
      IGN_WMS_OTHER_SUBGROUP,
    ],
  },
];
