import { LayerSubgroup, LayerType, LayerCategory, ActiveLayerGroup } from '../../../models';
import { environment } from '../../../../environments/environment';

/**
 * Valores por defecto para capas WMS del IGN
 * Opacidad 100% y grupo overlay (siempre por encima de capas de datos)
 */
const IGN_WMS_DEFAULTS = {
  visible: false,
  opacity: 100,
  zIndexGroup: ActiveLayerGroup.OVERLAY, // Siempre por encima de capas de datos
  type: LayerType.WMS,
  category: LayerCategory.IGN_WMS,
} as const;

/**
 * Definición de capas WMS del Instituto Geográfico Nacional (IGN) de Argentina
 * Servicio WMS: https://wms.ign.gob.ar/geoserver/ows
 */
export const IGN_WMS_LIMITS_SUBGROUP: LayerSubgroup = {
  id: 'ign-limits',
  name: 'Límites (IGN)',
  description: 'Límites político-administrativos de Argentina',
  expanded: true,
  layers: [
    {
      id: 'ign-limite-internacional',
      name: 'Límite Internacional',
      description: 'Límite internacional de Argentina',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-provincial',
      name: 'Límites Provinciales',
      description: 'Límites entre provincias',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-departamental',
      name: 'Límites Departamentales',
      description: 'Límites entre departamentos',
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};

export const IGN_WMS_GEOGRAPHIC_SUBGROUP: LayerSubgroup = {
  id: 'ign-geographic',
  name: 'Elementos Geográficos (IGN)',
  description: 'Elementos geográficos de Argentina',
  expanded: false,
  layers: [
    {
      id: 'ign-localidades',
      name: 'Localidades',
      description: 'Localidades de Argentina',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-vias-nacionales',
      name: 'Rutas Nacionales',
      description: 'Red vial nacional',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-vias-provinciales',
      name: 'Rutas Provinciales',
      description: 'Red vial provincial',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-ferrocarriles',
      name: 'Ferrocarriles',
      description: 'Red ferroviaria',
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};

export const IGN_WMS_INFRASTRUCTURE_SUBGROUP: LayerSubgroup = {
  id: 'ign-infrastructure',
  name: 'Infraestructura (IGN)',
  description: 'Infraestructura y servicios',
  expanded: false,
  layers: [
    {
      id: 'ign-aeropuertos',
      name: 'Aeropuertos',
      description: 'Aeropuertos y aeródromos',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-puertos',
      name: 'Puertos',
      description: 'Puertos marítimos y fluviales',
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
/**
 * Configuración de tiles WMS del Instituto Geográfico Nacional (IGN) de Argentina
 */

/**
 * Configuración base para los servicios WMS del IGN
 */
export const IGN_WMS_BASE_CONFIG = {
  baseUrl: 'https://wms.ign.gob.ar/geoserver/ows',
  version: '1.3.0',
  format: 'image/png',
  transparent: true,
  attribution:
    '<a href="https://www.ign.gob.ar/" target="_blank">Instituto Geográfico Nacional</a>',
} as const;

/**
 * Mapeo de IDs de capas a nombres de capas WMS del IGN
 */
export const IGN_WMS_LAYER_NAMES: Record<string, string> = {
  // Límites
  'ign-limite-internacional': 'linea_de_limite_FA004',
  'ign-limite-provincial': 'linea_de_limite_070111',
  'ign-limite-departamental': 'linea_de_limite_070110',
  'ign-provincias': 'provincia',
  'ign-municipios': 'municipio',

  // Elementos geográficos
  'ign-localidades': 'localidad_bahra',
  'ign-vias-nacionales': 'vial_nacional',
  'ign-vias-provinciales': 'vial_provincial',
  'ign-ferrocarriles': 'lineas_de_transporte_ferroviario_AN010',
  'ign-rios-perennes': 'lineas_de_aguas_continentales_perenne',
  'ign-cuerpos-agua': 'areas_de_aguas_continentales_perenne',

  // Infraestructura
  'ign-aeropuertos': 'puntos_de_transporte_aereo_GB005',
  'ign-puertos': 'puntos_de_puertos_y_muelles_BB005',
  'ign-pasos-fronterizos': 'pasos_de_fronteras_internacionales',
  'ign-hitos-internacionales': 'hitos_internacionales',
};

/**
 * Obtiene el nombre de capa WMS para un ID de capa dado
 */
export function getIgnWmsLayerName(layerId: string): string | undefined {
  return IGN_WMS_LAYER_NAMES[layerId];
}
