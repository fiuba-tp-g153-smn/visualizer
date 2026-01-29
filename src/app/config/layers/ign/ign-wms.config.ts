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
    {
      id: 'ign-limite-area-protegida',
      name: 'Límite de Área Protegida',
      description: 'Límites de áreas protegidas',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-zona-frontera',
      name: 'Límite de Zona de Frontera',
      description: 'Límites de zonas de frontera',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-espacios-maritimos',
      name: 'Límites de Espacios Marítimos',
      description: 'Límites de espacios marítimos argentinos',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-hitos-internacionales',
      name: 'Hitos Internacionales',
      description: 'Hitos de límites internacionales',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-hitos-interprovinciales',
      name: 'Hitos Interprovinciales',
      description: 'Hitos de límites interprovinciales',
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
      id: 'ign-gobierno-local-punto',
      name: 'Gobierno Local (Punto)',
      description: 'Ubicación puntual de gobiernos locales',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-gobierno-local-poligono',
      name: 'Gobierno Local (Polígono)',
      description: 'Áreas de gobiernos locales',
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
    {
      id: 'ign-circulo-polar',
      name: 'Círculo Polar',
      description: 'Línea del círculo polar',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-ecuador',
      name: 'Ecuador',
      description: 'Línea del ecuador',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-tropico',
      name: 'Trópico',
      description: 'Línea del trópico',
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

export const IGN_WMS_MARITIME_SUBGROUP: LayerSubgroup = {
  id: 'ign-maritime',
  name: 'Espacios Marítimos (IGN)',
  description: 'Espacios marítimos argentinos',
  expanded: false,
  layers: [
    {
      id: 'ign-200-millas-antartico',
      name: '200 Millas desde Costa Sector Antártico',
      description: '200 millas marinas desde la costa del sector antártico',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-mar-territorial',
      name: 'Mar Territorial',
      description: 'Mar territorial argentino',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-plataforma-continental',
      name: 'Plataforma Continental',
      description: 'Plataforma continental argentina',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-zona-contigua',
      name: 'Zona Contigua',
      description: 'Zona contigua argentina',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-zona-economica-exclusiva',
      name: 'Zona Económica Exclusiva',
      description: 'Zona económica exclusiva argentina',
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};

export const IGN_WMS_GEODESY_SUBGROUP: LayerSubgroup = {
  id: 'ign-geodesy',
  name: 'Redes Geodésicas (IGN)',
  description: 'Redes geodésicas y de nivelación',
  expanded: false,
  layers: [
    {
      id: 'ign-red-gps-ramsac',
      name: 'Red GPS/GNSS RAMSAC',
      description: 'Red de estaciones GPS/GNSS RAMSAC',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-nivelacion-alta-precision',
      name: 'Nivelación Alta Precisión',
      description: 'Red de nivelación de alta precisión',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-nivelacion-precision',
      name: 'Nivelación Precisión',
      description: 'Red de nivelación de precisión',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-nivelacion-topografica',
      name: 'Nivelación Topográfica',
      description: 'Red de nivelación topográfica',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-posgar07',
      name: 'Red POSGAR07',
      description: 'Red geodésica POSGAR07',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-densificacion-posgar07',
      name: 'Densificación POSGAR07',
      description: 'Red geodésica de densificación POSGAR07',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-pasma',
      name: 'Red PASMA',
      description: 'Red geodésica PASMA',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-provincial',
      name: 'Red Provincial',
      description: 'Red geodésica provincial',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-bacara',
      name: 'Red Gravimétrica BACARA',
      description: 'Red gravimétrica BACARA',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-primer-orden',
      name: 'Red Gravimétrica Primer Orden',
      description: 'Red gravimétrica de primer orden',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-segundo-orden',
      name: 'Red Gravimétrica Segundo Orden',
      description: 'Red gravimétrica de segundo orden',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-tercer-orden',
      name: 'Red Gravimétrica Tercer Orden',
      description: 'Red gravimétrica de tercer orden',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-igsn71',
      name: 'Red Gravimétrica IGSN 71',
      description: 'Red gravimétrica IGSN 71',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-raga',
      name: 'Red Gravimétrica RAGA',
      description: 'Red gravimétrica RAGA',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-red-ramsac-ntrip',
      name: 'Red RAMSAC-NTRIP',
      description: 'Red RAMSAC-NTRIP',
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};

export const IGN_WMS_TERRITORIAL_SUBGROUP: LayerSubgroup = {
  id: 'ign-territorial',
  name: 'Unidades Territoriales (IGN)',
  description: 'Divisiones político-administrativas',
  expanded: false,
  layers: [
    {
      id: 'ign-area-desarrollo-fronteras',
      name: 'Área Desarrollo de Fronteras',
      description: 'Áreas de desarrollo de fronteras',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-area-protegida',
      name: 'Área Protegida',
      description: 'Áreas naturales protegidas',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-departamento',
      name: 'Departamento',
      description: 'Divisiones departamentales',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-pais',
      name: 'País',
      description: 'Límites del país',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-provincia',
      name: 'Provincia',
      description: 'Divisiones provinciales',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-zona-frontera-area',
      name: 'Zona de Frontera',
      description: 'Áreas de zona de frontera',
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
  'ign-limite-internacional': 'ign:linea_de_limite_FA004',
  'ign-limite-provincial': 'ign:linea_de_limite_070111',
  'ign-limite-departamental': 'ign:linea_de_limite_070110',
  'ign-limite-area-protegida': 'ign:linea_de_limite_070114',
  'ign-limite-zona-frontera': 'ign:linea_de_limite_070112',
  'ign-limite-espacios-maritimos': 'ign:linea_limite_maritimos',
  'ign-hitos-internacionales': 'ign:hitos_internacionales',
  'ign-hitos-interprovinciales': 'ign:hitos_interprovinciales',
  'ign-provincias': 'ign:provincia',
  'ign-municipios': 'ign:municipio',

  // Elementos geográficos
  'ign-localidades': 'ign:localidad_bahra',
  'ign-gobierno-local-punto': 'ign:localidad_bahra', // Using localidad_bahra as closest match
  'ign-gobierno-local-poligono': 'ign:gobiernoslocales_2022',
  'ign-vias-nacionales': 'ign:vial_nacional',
  'ign-vias-provinciales': 'ign:vial_provincial',
  'ign-ferrocarriles': 'ign:lineas_de_transporte_ferroviario_AN010',
  'ign-rios-perennes': 'ign:lineas_de_aguas_continentales_perenne',
  'ign-cuerpos-agua': 'ign:areas_de_aguas_continentales_perenne',
  'ign-circulo-polar': 'ign:lineas_terrestres_070401',
  'ign-ecuador': 'ign:lineas_terrestres_070403',
  'ign-tropico': 'ign:lineas_terrestres_070402',

  // Infraestructura
  'ign-aeropuertos': 'ign:puntos_de_transporte_aereo_GB005',
  'ign-puertos': 'ign:puntos_de_puertos_y_muelles_BB005',
  'ign-pasos-fronterizos': 'ign:pasos_de_fronteras_internacionales',

  // Espacios marítimos
  'ign-200-millas-antartico': 'ign:doscientas_millas_sector_antartico',
  'ign-mar-territorial': 'ign:mar_territorial_argentino',
  'ign-plataforma-continental': 'ign:plataforma_continental',
  'ign-zona-contigua': 'ign:zona_contigua_argentina',
  'ign-zona-economica-exclusiva': 'ign:zona_economica_exclusiva_argentina',

  // Redes geodésicas
  'ign-red-gps-ramsac': 'ign:ramsac',
  'ign-red-nivelacion-alta-precision': 'ign:nivelacion_alta_precision',
  'ign-red-nivelacion-precision': 'ign:nivelacion_precision',
  'ign-red-nivelacion-topografica': 'ign:nivelacion_topografica',
  'ign-red-posgar07': 'ign:red_posgar',
  'ign-red-densificacion-posgar07': 'ign:red_densificacion_posgar',
  'ign-red-pasma': 'ign:red_pasma',
  'ign-red-provincial': 'ign:red_provincial',
  'ign-red-gravimetrica-bacara': 'ign:gravimetria_bacara',
  'ign-red-gravimetrica-primer-orden': 'ign:gravimetria_rpo',
  'ign-red-gravimetrica-segundo-orden': 'ign:gravimetria_rso',
  'ign-red-gravimetrica-tercer-orden': 'ign:gravimetria_rto',
  'ign-red-gravimetrica-igsn71': 'ign:gravimetria_igsn71',
  'ign-red-gravimetrica-raga': 'ign:gravimetria_raga',
  'ign-red-ramsac-ntrip': 'ign:ramsac_ntrip',

  // Unidades territoriales
  'ign-area-desarrollo-fronteras': 'ign:area_de_desarrollo_de_fronteras',
  'ign-area-protegida': 'ign:area_protegida',
  'ign-departamento': 'ign:departamento',
  'ign-pais': 'ign:pais',
  'ign-provincia': 'ign:provincia',
  'ign-zona-frontera-area': 'ign:zona_de_frontera',
};

/**
 * Obtiene el nombre de capa WMS para un ID de capa dado
 */
export function getIgnWmsLayerName(layerId: string): string | undefined {
  return IGN_WMS_LAYER_NAMES[layerId];
}
