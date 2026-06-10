import { LayerCategory, LayerType } from '../../../models';
import { ActiveLayerGroupId, LayerSubgroup } from '../../../models/layers/groups.models';

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
  attribution:
    '<a href="https://www.ign.gob.ar/" target="_blank">Instituto Geográfico Nacional</a>',
} as const;

export const IGN_WMS_WORKSPACE_URLS: Record<string, string> = {
  ows: 'https://wms.ign.gob.ar/geoserver/ows',
  limites: 'https://wms.ign.gob.ar/geoserver/limites/wms',
  'relieve-suelo': 'https://wms.ign.gob.ar/geoserver/relieve-suelo/wms',
};

/**
 * IGN WMS layer IDs whose tiles are also pre-scraped and cached by the
 * data-service basemap pipeline. For these IDs the renderer serves XYZ
 * tiles from `/basemap/{layerId}/{z}/{x}/{y}.png` (which itself relays
 * to upstream WMS and falls back to Redis/S3 caches). Layers not in this
 * set continue to hit `wms.ign.gob.ar` directly through Leaflet's WMS
 * facade.
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
  name: 'Límites',
  description: 'Límites políticos y administrativos',
  layers: [
    {
      id: 'ign-limite-interdepartamental-o-de-partido',
      name: 'Límite interdepartamental o de partido',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita la jurisdicción de un departamento o partido de otro.',
      wmsLayerName: 'ign:linea_de_limite_070110',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-internacional',
      name: 'Límite internacional',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita un país.',
      wmsLayerName: 'linea_de_limite_FA004',
      wmsWorkspace: 'limites',
      ...IGN_WMS_DEFAULTS,
    },
  ],
};

export const IGN_WMS_ADMINISTRATIVE_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-administrative',
  name: 'Administrativo',
  description: 'Límites administrativos y divisiones territoriales',
  layers: [
    {
      id: 'ign-localidad',
      name: 'Localidad',
      description:
        'Superficie terrestre caracterizada por la continuidad de áreas edificadas y no edificadas conectadas entre sí por una red de calles donde se concentra población.',
      wmsLayerName: 'ign:localidad_bahra',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-sublocalidad',
      name: 'Sublocalidad',
      description: 'Subdivisión de una localidad según legislación del gobierno local.',
      wmsLayerName: 'ign:sublocalidad_entidad_bahra',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-gobierno-local',
      name: 'Gobierno local',
      description:
        'Jurisdicción político-administrativa de tercer o cuarto orden. Incluye Municipios, Comunas, Juntas y Comisiones.',
      wmsLayerName: 'gobiernoslocales_2022',
      wmsWorkspace: 'limites',
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-provincia',
      name: 'Provincia',
      description:
        'División político territorial de primer orden. Incluye la Ciudad Autónoma de Buenos Aires (CABA).',
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
  name: 'Territorial',
  description: 'Organización territorial',
  layers: [
    {
      id: 'ign-area-de-montana',
      name: 'Área de montaña',
      description:
        'Áreas que representan las diferentes regiones montañosas de la República Argentina.',
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
  name: 'Infraestructura',
  description: 'Infraestructura física y construcciones',
  layers: [
    {
      id: 'ign-aerodromo',
      name: 'Aeródromo',
      description:
        'Lugar de aterrizaje de aeronaves de menor porte que un aeropuerto, con o sin instalaciones de servicios y sin aduana. Incluye aeroclub.',
      wmsLayerName: 'ign:puntos_de_transporte_aereo_GB001',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-aeropuerto',
      name: 'Aeropuerto',
      description:
        'Estación terrestre provista de un conjunto de pistas, instalaciones y servicios destinados al tráfico regular de aeronaves. Puede tener aduana.',
      wmsLayerName: 'ign:puntos_de_transporte_aereo_GB005',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-helipuerto',
      name: 'Helipuerto',
      description:
        'Pista circular marcada con una letra ¨H¨, para la operación de aeronaves de despegue vertical. Puede incluir instalaciones asociadas.',
      wmsLayerName: 'ign:puntos_de_transporte_aereo_GB035',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-red-vial-nacional',
      name: 'Red vial nacional',
      description:
        'Representa los objetos geográficos relativos a vías de circulación de jurisdicción nacional.',
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
  name: 'Hidrografía',
  description: 'Cursos de agua, lagos y características hidrográficas',
  layers: [
    {
      id: 'ign-corriente-de-agua',
      name: 'Corriente de agua',
      description:
        'Flujo natural de agua que sigue los desniveles del terreno y desemboca en otra corriente de agua, en un espejo de agua o en el mar.',
      wmsLayerName: 'ign:areas_de_aguas_continentales_BH140',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-ferrocarril',
      name: 'Ferrocarril',
      description:
        'Vía férrea constituida por dos o tres rieles o carriles paralelos entre sí, sobre los cuales encajan y giran las ruedas de las locomotoras y vagones que conforman los trenes.',
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
  name: 'Defensa y seguridad',
  description: 'Infraestructura de defensa y seguridad',
  layers: [
    {
      id: 'ign-cuartel-de-bomberos',
      name: 'Cuartel de bomberos',
      description:
        'Estructura preparada para almacenar el equipamiento necesario para apagar fuegos, incluyendo mangueras, vehículos, equipos de protección del personal, extintores de fuego, entre otros. Incluye instalaciones anexas.',
      wmsLayerName: 'estructuras_operativas_y_defensivas_090102',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-pasos-de-fronteras-internacionales',
      name: 'Pasos de fronteras internacionales',
      description:
        'Paso de Frontera Internacional (PFI) identifica un punto de entrada y salida de personas, mercaderías y medios de transporte, que vincula de manera directa (por medios fluviales o terrestres) a la República Argentina con los cinco países vecinos. Quedan exceptuados el Puerto de Buenos Aires, todos los Aeropuertos, los puertos ubicados sobre la Hidrovía y los puertos Marítimos.',
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
  name: 'Otros',
  description: 'Otras capas temáticas',
  layers: [
    {
      id: 'ign-linea-de-transmision-electrica',
      name: 'Línea de transmisión eléctrica',
      description:
        'Sistema de cableado compuesto por torres y cables que transmite o distribuye energía eléctrica.',
      wmsLayerName: 'ign:lineas_de_energia_AT030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-central-electrica',
      name: 'Central eléctrica',
      description: 'Edificio y equipamiento necesario para la generación de energía eléctrica. ',
      wmsLayerName: 'ign:puntos_de_energia_AD010',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-centro-de-esqui',
      name: 'Centro de esquí',
      description:
        'Área que dispone de pistas de esquí y medios de elevación. Puede contener hoteles y espacio para usar trineos.',
      wmsLayerName: 'ign:puntos_de_recreacion_020401',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
  ],
};
