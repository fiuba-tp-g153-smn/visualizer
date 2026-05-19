import { ABI_SUBGROUP } from './goes/abi/config';
import { GLM_SUBGROUP } from './goes/glm/config';
import { RADAR_SUBGROUPS } from './radar/config';
import { ECMWF_SUBGROUP } from './ecmwf/config';
import { SMN_STATIONS_SUBGROUP } from './smn-stations/config';
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

/**
 * Definición de capas disponibles en el visualizador
 */
export const LAYER_DEFINITIONS: LayerGroup[] = [
  {
    id: 'goes-19',
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
    icon: 'track_changes',
    expanded: false,
    subgroups: RADAR_SUBGROUPS,
  },
  {
    id: 'modelos',
    name: 'Modelos',
    description: 'Modelos numéricos de pronóstico',
    icon: 'insights',
    expanded: false,
    subgroups: [ECMWF_SUBGROUP],
  },
  {
    id: 'smn-estaciones',
    name: 'Estaciones Meteorológicas',
    description: 'Observaciones actuales de estaciones meteorológicas del SMN',
    icon: 'thermostat',
    expanded: false,
    subgroups: [SMN_STATIONS_SUBGROUP],
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
    name: 'Capas de Datos',
    subtitle: '(Radar, modelos numéricos)',
    description:
      'Capas de datos científicos: radar meteorológico, salidas de modelos numéricos, imágenes satelitales, etc.',
    icon: 'satellite_alt',
    zIndexRange: { min: 1, max: 1000 },
  },
  [ActiveLayerGroupId.OVERLAY]: {
    id: ActiveLayerGroupId.OVERLAY,
    name: 'Capas de Referencia',
    subtitle: '(IGN, cartografía)',
    description:
      'Capas de referencia cartográfica del IGN. Siempre se muestran por encima de las capas de datos.',
    icon: 'terrain',
    zIndexRange: { min: 1001, max: 2000 },
  },
  [ActiveLayerGroupId.POINTS]: {
    id: ActiveLayerGroupId.POINTS,
    name: 'Capas Puntuales',
    subtitle: '(Estaciones, puntos de observación)',
    description:
      'Capas puntuales interactivas. Se muestran por encima de las capas de referencia para mantener legibilidad.',
    icon: 'place',
    zIndexRange: { min: 2001, max: 3000 },
  },
};
