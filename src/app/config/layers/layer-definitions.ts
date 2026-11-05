import { ABI_SUBGROUP } from './goes/abi/config';
import { GLM_SUBGROUP } from './goes/glm/config';
import { RADAR_SUBGROUPS } from './radar/config';
import { ECMWF_SUBGROUP } from './ecmwf/config';
import { GFS_SUBGROUP } from './gfs/config';
import { WEATHER_STATIONS_SUBGROUP } from './weather-stations/config';
import { WRF_SUBGROUP } from './wrf/config';
import {
  IGN_WMS_ADMINISTRATIVE_SUBGROUP,
  IGN_WMS_DEFENSE_SECURITY_SUBGROUP,
  IGN_WMS_HYDROGRAPHY_SUBGROUP,
  IGN_WMS_INFRASTRUCTURE_SUBGROUP,
  IGN_WMS_LIMITS_SUBGROUP,
  IGN_WMS_OTHER_SUBGROUP,
  IGN_WMS_TERRITORIAL_SUBGROUP,
} from './ign-wms/config';
import {
  ActiveLayerGroup,
  ActiveLayerGroupId,
  LayerGroup,
} from '../../models/layers/groups.models';
import { LAYER_NAMES } from '../../texts';

/**
 * Definición de capas disponibles en el visualizador
 */
export const LAYER_DEFINITIONS: LayerGroup[] = [
  {
    id: 'goes19',
    name: LAYER_NAMES.groups.goes19.name,
    description: LAYER_NAMES.groups.goes19.description,
    icon: 'satellite_alt',
    expanded: false,
    subgroups: [ABI_SUBGROUP, GLM_SUBGROUP],
  },
  {
    id: 'radar',
    name: LAYER_NAMES.groups.radar.name,
    description: LAYER_NAMES.groups.radar.description,
    icon: 'track_changes',
    expanded: false,
    subgroups: RADAR_SUBGROUPS,
  },
  {
    id: 'modelos',
    name: LAYER_NAMES.groups.modelos.name,
    description: LAYER_NAMES.groups.modelos.description,
    icon: 'insights',
    expanded: false,
    subgroups: [ECMWF_SUBGROUP, WRF_SUBGROUP, GFS_SUBGROUP],
  },
  {
    id: 'smn-estaciones',
    name: LAYER_NAMES.groups.smnEstaciones.name,
    description: LAYER_NAMES.groups.smnEstaciones.description,
    icon: 'thermostat',
    expanded: false,
    subgroups: [WEATHER_STATIONS_SUBGROUP],
  },
  {
    id: 'ign-wms',
    name: LAYER_NAMES.groups.ignWms.name,
    description: LAYER_NAMES.groups.ignWms.description,
    icon: 'map',
    expanded: false,
    subgroups: [
      IGN_WMS_LIMITS_SUBGROUP,
      IGN_WMS_ADMINISTRATIVE_SUBGROUP,
      IGN_WMS_TERRITORIAL_SUBGROUP,
      IGN_WMS_INFRASTRUCTURE_SUBGROUP,
      IGN_WMS_HYDROGRAPHY_SUBGROUP,
      IGN_WMS_DEFENSE_SECURITY_SUBGROUP,
      IGN_WMS_OTHER_SUBGROUP,
    ],
  },
];

/**
 * Definición de grupos de capas activas para organizar por niveles
 * Las capas solo se pueden reordenar dentro de su propio grupo
 */
export const ACTIVE_LAYER_GROUP_DEFINITIONS: Record<ActiveLayerGroupId, ActiveLayerGroup> = {
  [ActiveLayerGroupId.BASE]: {
    id: ActiveLayerGroupId.BASE,
    name: LAYER_NAMES.groups.base.name,
    subtitle: LAYER_NAMES.groups.base.subtitle,
    description: LAYER_NAMES.groups.base.description,
    icon: 'satellite_alt',
    zIndexRange: { min: 1, max: 1000 },
  },
  [ActiveLayerGroupId.OVERLAY]: {
    id: ActiveLayerGroupId.OVERLAY,
    name: LAYER_NAMES.groups.overlay.name,
    subtitle: LAYER_NAMES.groups.overlay.subtitle,
    description: LAYER_NAMES.groups.overlay.description,
    icon: 'terrain',
    zIndexRange: { min: 1001, max: 2000 },
  },
  [ActiveLayerGroupId.POINTS]: {
    id: ActiveLayerGroupId.POINTS,
    name: LAYER_NAMES.groups.points.name,
    subtitle: LAYER_NAMES.groups.points.subtitle,
    description: LAYER_NAMES.groups.points.description,
    icon: 'place',
    zIndexRange: { min: 2001, max: 3000 },
  },
};
