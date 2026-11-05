import { LayerCategory, LayerType } from '../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../models/layers/groups.models';
import { LAYER_NAMES } from '../../../texts';

const IGN_GROUP_DEFAULTS = {
  expanded: false,
} as const;

const IGN_WMS_DEFAULTS = {
  zIndexGroup: ActiveLayerGroupId.OVERLAY,
  type: LayerType.WMS,
  category: LayerCategory.IGN_WMS,
} as const;

export const IGN_WMS_BASE_CONFIG = {
  defaultUrl: 'https://wms.ign.gob.ar/geoserver/ows',
  version: '1.3.0',
  format: 'image/png',
  transparent: true,
  attribution: LAYER_NAMES.ign.attribution,
} as const;

export const IGN_WMS_WORKSPACE_URLS: Record<string, string> = {
  ows: 'https://wms.ign.gob.ar/geoserver/ows',
  limites: 'https://wms.ign.gob.ar/geoserver/limites/wms',
  'relieve-suelo': 'https://wms.ign.gob.ar/geoserver/relieve-suelo/wms',
};

/**
 * How long a backed-up IGN tile may spend on `wms.ign.gob.ar` before the
 * renderer gives up on it and serves the data-service S3 backup instead.
 *
 * An `<img>` has no load timeout of its own, and a host that blackholes TCP
 * (connect never completes, no RST) leaves the request hanging for the
 * browser's own connect timeout. This bounds that wait explicitly.
 */
export const IGN_WMS_RELAY_TIMEOUT_MS = 5_000;

/**
 * Deepest zoom the data-service basemap backup covers, mirroring
 * `data-service::basemap_cache_max_zoom`. Leaflet loads tiles from this level
 * and upscales beyond it, so a backed-up overlay keeps rendering (pixelated)
 * when zoomed past the backup rather than going blank during an IGN outage.
 */
export const IGN_WMS_BACKUP_MAX_NATIVE_ZOOM = 11;

/**
 * IGN WMS layer IDs whose tiles are also pre-scraped and backed up by the
 * data-service basemap pipeline.
 *
 * For these IDs `wms.ign.gob.ar` stays the primary source — upstream is
 * authoritative — but each tile carries a `IGN_WMS_RELAY_TIMEOUT_MS`
 * deadline. If the tile has not loaded by then the renderer repoints it at
 * `/basemap/{layerId}/{z}/{x}/{y}.png`, which serves the S3 backup. Without
 * that deadline a dead WMS host costs the browser's own connect timeout
 * (~30 s, and only 6 sockets per host), which is what made these layers look
 * permanently broken during an outage rather than merely slow.
 *
 * Layers not in this set have no backup and keep hitting `wms.ign.gob.ar`
 * directly through Leaflet's WMS facade, with no deadline.
 *
 * Keep in sync with `data-service::basemap.providers` (settings.json).
 */
export const IGN_WMS_BACKED_UP_LAYER_IDS: ReadonlySet<string> = new Set([
  'ign-provincia',
  'ign-limite-internacional',
  'ign-limite-interdepartamental-o-de-partido',
  'ign-localidad',
  'ign-sublocalidad',
  'ign-gobierno-local',
]);

export const IGN_WMS_LIMITS_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-limits',
  name: LAYER_NAMES.ign.ignLimits.name,
  description: LAYER_NAMES.ign.ignLimits.description,
  layers: [
    {
      id: 'ign-limite-interdepartamental-o-de-partido',
      name: LAYER_NAMES.ign.ignLimiteInterdepartamentalODePartido.name,
      description: LAYER_NAMES.ign.ignLimiteInterdepartamentalODePartido.description,
      wmsLayerName: 'ign:linea_de_limite_070110',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-internacional',
      name: LAYER_NAMES.ign.ignLimiteInternacional.name,
      description: LAYER_NAMES.ign.ignLimiteInternacional.description,
      wmsLayerName: 'linea_de_limite_FA004',
      wmsWorkspace: 'limites',
      ...IGN_WMS_DEFAULTS,
    },
  ],
};

export const IGN_WMS_ADMINISTRATIVE_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-administrative',
  name: LAYER_NAMES.ign.ignAdministrative.name,
  description: LAYER_NAMES.ign.ignAdministrative.description,
  layers: [
    {
      id: 'ign-localidad',
      name: LAYER_NAMES.ign.ignLocalidad.name,
      description: LAYER_NAMES.ign.ignLocalidad.description,
      wmsLayerName: 'ign:localidad_bahra',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-sublocalidad',
      name: LAYER_NAMES.ign.ignSublocalidad.name,
      description: LAYER_NAMES.ign.ignSublocalidad.description,
      wmsLayerName: 'ign:sublocalidad_entidad_bahra',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-gobierno-local',
      name: LAYER_NAMES.ign.ignGobiernoLocal.name,
      description: LAYER_NAMES.ign.ignGobiernoLocal.description,
      wmsLayerName: 'gobiernoslocales_2022',
      wmsWorkspace: 'limites',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-provincia',
      name: LAYER_NAMES.ign.ignProvincia.name,
      description: LAYER_NAMES.ign.ignProvincia.description,
      wmsLayerName: 'provincia_FA003',
      wmsWorkspace: 'limites',
      ...IGN_WMS_DEFAULTS,
    },
  ],
};

// Territorial
const IGN_WMS_TERRITORIAL_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
} as const;

export const IGN_WMS_TERRITORIAL_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-territorial',
  name: LAYER_NAMES.ign.ignTerritorial.name,
  description: LAYER_NAMES.ign.ignTerritorial.description,
  layers: [
    {
      id: 'ign-area-de-montana',
      name: LAYER_NAMES.ign.ignAreaDeMontana.name,
      description: LAYER_NAMES.ign.ignAreaDeMontana.description,
      wmsLayerName: 'ign:area_de_montana',
      wmsWorkspace: 'relieve-suelo',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
  ],
};

// Infraestructura
const IGN_WMS_INFRASTRUCTURE_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
} as const;

export const IGN_WMS_INFRASTRUCTURE_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-infrastructure',
  name: LAYER_NAMES.ign.ignInfrastructure.name,
  description: LAYER_NAMES.ign.ignInfrastructure.description,
  layers: [
    {
      id: 'ign-aerodromo',
      name: LAYER_NAMES.ign.ignAerodromo.name,
      description: LAYER_NAMES.ign.ignAerodromo.description,
      wmsLayerName: 'ign:puntos_de_transporte_aereo_GB001',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-aeropuerto',
      name: LAYER_NAMES.ign.ignAeropuerto.name,
      description: LAYER_NAMES.ign.ignAeropuerto.description,
      wmsLayerName: 'ign:puntos_de_transporte_aereo_GB005',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-helipuerto',
      name: LAYER_NAMES.ign.ignHelipuerto.name,
      description: LAYER_NAMES.ign.ignHelipuerto.description,
      wmsLayerName: 'ign:puntos_de_transporte_aereo_GB035',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-red-vial-nacional',
      name: LAYER_NAMES.ign.ignRedVialNacional.name,
      description: LAYER_NAMES.ign.ignRedVialNacional.description,
      wmsLayerName: 'ign:vial_nacional',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
  ],
};

const IGN_WMS_HYDROGRAPHY_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
} as const;

export const IGN_WMS_HYDROGRAPHY_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-hydrography',
  name: LAYER_NAMES.ign.ignHydrography.name,
  description: LAYER_NAMES.ign.ignHydrography.description,
  layers: [
    {
      id: 'ign-corriente-de-agua',
      name: LAYER_NAMES.ign.ignCorrienteDeAgua.name,
      description: LAYER_NAMES.ign.ignCorrienteDeAgua.description,
      wmsLayerName: 'ign:areas_de_aguas_continentales_BH140',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-ferrocarril',
      name: LAYER_NAMES.ign.ignFerrocarril.name,
      description: LAYER_NAMES.ign.ignFerrocarril.description,
      wmsLayerName: 'ign:lineas_de_transporte_ferroviario_AN010',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
  ],
};

// Defensa y seguridad
const IGN_WMS_DEFENSE_SECURITY_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
} as const;

export const IGN_WMS_DEFENSE_SECURITY_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-defense-security',
  name: LAYER_NAMES.ign.ignDefenseSecurity.name,
  description: LAYER_NAMES.ign.ignDefenseSecurity.description,
  layers: [
    {
      id: 'ign-cuartel-de-bomberos',
      name: LAYER_NAMES.ign.ignCuartelDeBomberos.name,
      description: LAYER_NAMES.ign.ignCuartelDeBomberos.description,
      wmsLayerName: 'estructuras_operativas_y_defensivas_090102',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-pasos-de-fronteras-internacionales',
      name: LAYER_NAMES.ign.ignPasosDeFronterasInternacionales.name,
      description: LAYER_NAMES.ign.ignPasosDeFronterasInternacionales.description,
      wmsLayerName: 'pasos_de_fronteras_internacionales',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
  ],
};

// Otros
const IGN_WMS_OTHER_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
} as const;

export const IGN_WMS_OTHER_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-other',
  name: LAYER_NAMES.ign.ignOther.name,
  description: LAYER_NAMES.ign.ignOther.description,
  layers: [
    {
      id: 'ign-linea-de-transmision-electrica',
      name: LAYER_NAMES.ign.ignLineaDeTransmisionElectrica.name,
      description: LAYER_NAMES.ign.ignLineaDeTransmisionElectrica.description,
      wmsLayerName: 'ign:lineas_de_energia_AT030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-central-electrica',
      name: LAYER_NAMES.ign.ignCentralElectrica.name,
      description: LAYER_NAMES.ign.ignCentralElectrica.description,
      wmsLayerName: 'ign:puntos_de_energia_AD010',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-centro-de-esqui',
      name: LAYER_NAMES.ign.ignCentroDeEsqui.name,
      description: LAYER_NAMES.ign.ignCentroDeEsqui.description,
      wmsLayerName: 'ign:puntos_de_recreacion_020401',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
  ],
};
