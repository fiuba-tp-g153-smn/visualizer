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
