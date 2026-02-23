import { expand } from 'rxjs';
import { LayerCategory, LayerType } from '../../../models';
import { ActiveLayerGroup, LayerSubgroup } from '../../../models/layers/groups.models';

const IGN_GROUP_DEFAULTS = {
  expanded: false,
  groupId: 'ign',
} as const;

const IGN_WMS_DEFAULTS = {
  zIndexGroup: ActiveLayerGroup.OVERLAY,
  type: LayerType.WMS,
  category: LayerCategory.IGN_WMS,
  groupId: 'ign',
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

const IGN_WMS_LIMITS_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  wmsWorkspace: 'limites',
  subgroupId: 'ign-limits',
} as const;

export const IGN_WMS_LIMITS_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-limits',
  name: 'Límites (IGN)',
  description: 'Límites políticos y administrativos',
  layers: [
    {
      id: 'ign-limite-interdepartamental-o-de-partido',
      name: 'Límite interdepartamental o de partido',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita la jurisdicción de un departamento o partido de otro.',
      wmsLayerName: 'ign:linea_de_limite_070110',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
    {
      id: 'ign-limite-interprovincial',
      name: 'Límite interprovincial',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita una provincia de otra.',
      wmsLayerName: 'ign:linea_de_limite_070111',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
    {
      id: 'ign-limite-de-area-protegida',
      name: 'Límite de área protegida',
      description:
        'Línea que delimita el área de tierra y/o mar destinada a la protección y mantenimiento de la diversidad biológica y de los recursos naturales y culturales asociados.',
      wmsLayerName: 'ign:linea_de_limite_070114',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
    {
      id: 'ign-hitos-internacionales',
      name: 'Hitos internacionales',
      description:
        'Obra destinada a marcar o señalar la posición de un punto que constituya el deslinde del territorio internacional ',
      wmsLayerName: 'hitos_internacionales',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
    {
      id: 'ign-hitos-interprovinciales',
      name: 'Hitos interprovinciales',
      description:
        'Obra destinada a marcar o señalar la posición de un punto que constituya el deslinde del territorio interprovincial.',
      wmsLayerName: 'hitos_interprovinciales',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
    {
      id: 'ign-limite-internacional',
      name: 'Límite internacional',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita un país.',
      wmsLayerName: 'linea_de_limite_FA004',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
    {
      id: 'ign-limites-de-espacios-maritimos',
      name: 'Límites de espacios marítimos',
      description:
        'Líneas que representan los diferentes espacíos marítimos en su límite exterior.',
      wmsLayerName: 'linea_limite_maritimos',
      ...IGN_WMS_LIMITS_DEFAULTS,
    },
  ],
};

// Administrativo
const IGN_WMS_ADMINISTRATIVE_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-administrative',
} as const;

export const IGN_WMS_ADMINISTRATIVE_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-administrative',
  name: 'Administrativo (IGN)',
  description: 'Límites administrativos y divisiones territoriales',
  layers: [
    {
      id: 'ign-localidad',
      name: 'Localidad',
      description:
        'Superficie terrestre caracterizada por la continuidad de áreas edificadas y no edificadas conectadas entre sí por una red de calles donde se concentra población.',
      wmsLayerName: 'ign:localidad_bahra',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-pais',
      name: 'País',
      description: 'Nación jurídicamente organizada.',
      wmsLayerName: 'ign:pais',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-red-geodesica-provincial',
      name: 'Red geodésica Provincial',
      description: 'Red geodésica Provincial',
      wmsLayerName: 'ign:red_provincial',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-sublocalidad',
      name: 'Sublocalidad',
      description: 'Subdivisión de una localidad según legislación del gobierno local.',
      wmsLayerName: 'ign:sublocalidad_entidad_bahra',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-red-vial-provincial',
      name: 'Red vial provincial',
      description:
        'Representa los objetos geográficos relativos a vías de circulación de jurisdicción provincial.',
      wmsLayerName: 'ign:vial_provincial',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-departamento',
      name: 'Departamento',
      description: 'División político administrativa de segundo orden.',
      wmsLayerName: 'departamento_FA001',
      wmsWorkspace: 'limites',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-gobierno-local',
      name: 'Gobierno Local',
      description:
        'Jurisdicción político-administrativa de tercer o cuarto orden. Incluye Municipios, Comunas, Juntas y Comisiones.',
      wmsLayerName: 'gobiernoslocales_2022',
      wmsWorkspace: 'limites',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
    {
      id: 'ign-provincia',
      name: 'Provincia',
      description:
        'División político territorial de primer orden. Incluye la Ciudad Autónoma de Buenos Aires (CABA).',
      wmsLayerName: 'provincia_FA003',
      wmsWorkspace: 'limites',
      ...IGN_WMS_ADMINISTRATIVE_DEFAULTS,
    },
  ],
};

// Territorial
const IGN_WMS_TERRITORIAL_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-territorial',
} as const;

export const IGN_WMS_TERRITORIAL_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-territorial',
  name: 'Territorial (IGN)',
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
    {
      id: 'ign-area-de-vuelos',
      name: 'Área de vuelos',
      description: 'Áreas relevadas mediante un avión utilizando técnicas fotogramétricas.',
      wmsLayerName: 'ign:area_vuelos_dsr_sig',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-area-de-vuelos-vant',
      name: 'Área de vuelos VANT',
      description:
        'Áreas relevadas mediante un Vehículo Aéreo no Tripulado (VANT) utilizando técnicas fotogramétricas.',
      wmsLayerName: 'ign:area_vuelos_vant_sig',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-invernadero-vivero-huerta',
      name: 'Invernadero, vivero, huerta',
      description:
        'Terreno destinado al cultivo de hortalizas, legumbres, árboles y demás. En los casos de invernadero y vivero, pueden estar dotados de una cubierta translúcida. Incluye quinta.',
      wmsLayerName: 'ign:areas_de_actividad_agropecuaria_AJ110',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-espacio-verde',
      name: 'Espacio verde',
      description:
        'Terreno reservado en toda planta urbana como espacio destinado a jardines para recreo y expansión de la población. Incluye plaza, plaza seca, rotonda, jardín botánico, zoológico, entre otros.',
      wmsLayerName: 'ign:areas_de_equipamiento_AL170',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-zona-de-extraccion-minera',
      name: 'Zona de extracción minera',
      description:
        'Área donde se efectúa una actividad extractiva de origen minero. Incluye las instalaciones de producción, es decir, sitio que contiene todos los equipamientos de superficie necesarios para asistir a las actividades extractivas, tanto de hidrocarburos como mineras.',
      wmsLayerName: 'ign:areas_de_estructura_asociada_010601',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-cantera',
      name: 'Cantera',
      description:
        'Explotación generalmente a cielo abierto de la que se obtienen rocas industriales, ornamentales y otros materiales. Una cantera puede tener más de una cava.',
      wmsLayerName: 'ign:areas_de_extraccion_AA012',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-area-de-fabricacion-y-procesamiento',
      name: 'Área de fabricación y procesamiento',
      description:
        'Conjunto de instalaciones para producción o procesamiento de materias primas, transformándolas en bienes o productos utilizables en otras actividades. Incluye parques industriales y polos petroquímicos.',
      wmsLayerName: 'ign:areas_de_fabricacion_y_procesamiento_AC070',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-planta-de-tratamiento-de-efluentes-cloacales',
      name: 'Planta de tratamiento de efluentes cloacales',
      description: 'Conjunto de instalaciones destinadas al tratamiento de aguas servidas.',
      wmsLayerName: 'ign:areas_de_fabricacion_y_procesamiento_AC507',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-meseta',
      name: 'Meseta',
      description:
        'Forma de relieve elevada, plana y generalmente de gran extensión, limitada por barrancas, circundada por valles. Incluye loma, entre otros.',
      wmsLayerName: 'ign:areas_de_geomorfologia_050202',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-medano-duna',
      name: 'Médano, duna',
      description:
        'Acumulación de sedimentos sueltos, tamaño arena, que puede trasladarse por acción del viento. Puede estar en ambiente continental o costero.',
      wmsLayerName: 'ign:areas_de_geomorfologia_DB560',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-vertedero-basurero',
      name: 'Vertedero, basurero',
      description: 'Área destinada al depósito de materiales de desecho, sin tratamiento previo.',
      wmsLayerName: 'ign:areas_de_gestion_de_residuos_AB000',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-planta-de-tratamiento-de-residuos',
      name: 'Planta de tratamiento de residuos',
      description:
        'Conjunto de instalaciones donde se realiza algún tipo de clasificación o tratamiento a los residuos. Incluye las plantas de residuos patológicos y las plantas recicladoras.',
      wmsLayerName: 'ign:areas_de_gestion_de_residuos_AB030',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-barrera-de-hielo',
      name: 'Barrera de hielo',
      description:
        'Masa de hielo permanente, flotante y de espesor variable, formada a lo largo de la costa y que se encuentra adherida a ella avanzando sobre el océano.',
      wmsLayerName: 'ign:areas_de_glaciologia_050705',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-morena-morrena',
      name: 'Morena, morrena',
      description:
        'Acumulación heterogénea de detritos en cuanto a tamaño y composición que, llevada por el glaciar, es acumulada por éste. ',
      wmsLayerName: 'ign:areas_de_glaciologia_BJ020',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-isla',
      name: 'Isla',
      description:
        'Parte de la superficie terrestre rodeada de agua y de dimensiones menores que un continente.',
      wmsLayerName: 'ign:areas_de_zona_costera_BA030',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-playa-de-arena',
      name: 'Playa de arena',
      description:
        'Área ribereña de mar, corriente de agua o espejo de agua, que por lo general se caracteriza por ser una superficie casi plana de arena, conchilla o grava.',
      wmsLayerName: 'ign:areas_de_zona_costera_playa_areana',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-playa-de-grava',
      name: 'Playa de grava',
      description:
        'Área ribereña de mar, corriente de agua o espejo de agua, que por lo general se caracteriza por ser una superficie casi plana de arena, conchilla o grava.',
      wmsLayerName: 'ign:areas_de_zona_costera_playa_grava',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-playa-de-restinga',
      name: 'Playa de restinga',
      description:
        'Área ribereña de mar, corriente de agua o espejo de agua, que por lo general se caracteriza por ser una superficie casi plana de arena, conchilla o grava.',
      wmsLayerName: 'ign:areas_de_zona_costera_playa_restinga',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-accidente-costero',
      name: 'Accidente costero',
      description: 'Configuración geomorfológica de la zona litoral.',
      wmsLayerName: 'ign:lineas_de_zona_costera_BA040',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-area-protegida',
      name: 'Área protegida',
      description:
        'Área de tierra y/o mar destinada a la protección y mantenimiento de la diversidad biológica y de los recursos naturales y culturales asociados.',
      wmsLayerName: 'area_protegida_070115',
      wmsWorkspace: 'limites',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-zona-contigua-argentina',
      name: 'Zona Contigua argentina',
      description:
        'Zona marítima que se extiende desde el límite exterior del mar territorial, hasta una distancia de 24 millas marinas medidas a partir de la línea de base.',
      wmsLayerName: 'zona_contigua_argentina',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
    {
      id: 'ign-zona-economica-exclusiva-argentina',
      name: 'Zona Económica Exclusiva argentina',
      description:
        'Zona marítima que se extiende más allá del límite exterior del mar territorial, hasta una distancia de 200 millas marinas a partir de la línea de base.',
      wmsLayerName: 'zona_economica_exclusiva_argentina',
      ...IGN_WMS_TERRITORIAL_DEFAULTS,
    },
  ],
};

const IGN_WMS_GEOGRAPHIC_FEATURES_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-geographic-features',
} as const;

export const IGN_WMS_GEOGRAPHIC_FEATURES_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-geographic-features',
  name: 'Elementos Geográficos (IGN)',
  description: 'Características geográficas generales',
  layers: [
    {
      id: 'ign-circulo-polar',
      name: 'Círculo polar',
      description:
        '"Cada uno de los dos paralelos situados a 66º 33\' 45"" Norte y 66º 33\' 45"" Sur, refiriéndose respectivamente a los círculos polares Ártico y Antártico."',
      wmsLayerName: 'ign:lineas_terrestres_070401',
      ...IGN_WMS_GEOGRAPHIC_FEATURES_DEFAULTS,
    },
    {
      id: 'ign-tropico',
      name: 'Trópico',
      description:
        'Cada uno de los dos círculos imaginarios de la esfera celeste paralelos al Ecuador, ubicados aproximadamente a la latitudes de 23º 26` 17``,43 Norte y 23º 26` 17``,43 Sur.',
      wmsLayerName: 'ign:lineas_terrestres_070402',
      ...IGN_WMS_GEOGRAPHIC_FEATURES_DEFAULTS,
    },
    {
      id: 'ign-ecuador',
      name: 'Ecuador',
      description:
        'Círculo máximo, perpendicular al eje de rotación de la Tierra que la divide en dos hemisferios: Norte y Sur. En él se origina la coordenada geográfica latitud.',
      wmsLayerName: 'ign:lineas_terrestres_070403',
      ...IGN_WMS_GEOGRAPHIC_FEATURES_DEFAULTS,
    },
  ],
};

// Infraestructura
const IGN_WMS_INFRASTRUCTURE_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-infrastructure',
} as const;

export const IGN_WMS_INFRASTRUCTURE_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-infrastructure',
  name: 'Infraestructura (IGN)',
  description: 'Infraestructura física y construcciones',
  layers: [
    {
      id: 'ign-planta-urbana',
      name: 'Planta urbana',
      description:
        'Área urbana aproximada que incluye la zona contigua de amanzanamiento edificado, cuyos límites son reconocibles.',
      wmsLayerName: 'ign:areas_de_asentamientos_y_edificios_020105',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-edificio-de-cultura',
      name: 'Edificio de cultura',
      description:
        'Construcción destinada a la manifestación de expresiones culturales y artísticas.',
      wmsLayerName: 'ign:cultura_y_religion_AL021',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-edificio-religioso',
      name: 'Edificio religioso',
      description: 'Construcción destinada a la práctica de actividades religiosas.',
      wmsLayerName: 'ign:cultura_y_religion_AL330',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-sedimento-fluvial',
      name: 'Sedimento Fluvial',
      description:
        'Grava y bloques redondeados, arena y otros sedimentos finos transportados por la acción fluvial y que son depositados en las planicies aluviales actuales o antiguas (albardones y terrazas).',
      wmsLayerName: 'ign:edafologia_sedimento_fluvial',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-estacion-de-peaje',
      name: 'Estación de peaje',
      description:
        'Conjunto de instalaciones situadas sobre una vía de transporte con el fin de cobrar la tasa correspondiente al mantenimiento, mejoramiento y conservación de la vía en cuestión.',
      wmsLayerName: 'ign:infraestructura_de_transporte_030801',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-indicador-de-kilometros',
      name: 'Indicador de kilómetros',
      description:
        'Mojón de madera, metal o cemento que indica la distancia en kilómetros desde ese punto al origen. Se sitúan alternativamente a un lado y otro en vías de transporte y ferrocarril. ',
      wmsLayerName: 'ign:infraestructura_de_transporte_030803',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-estacion-de-omnibus',
      name: 'Estación de ómnibus',
      description:
        'Predio destinado a la maniobra de ómnibus nacionales e internacionales, carga, ascenso y descenso de pasajeros. Puede o no tener aduana.',
      wmsLayerName: 'ign:infraestructura_de_transporte_AQ125',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-estacion-de-servicio',
      name: 'Estación de servicio',
      description:
        'Conjunto de instalaciones ubicadas a la vera de una vía de comunicación, destinada a la provisión de combustible y asistencia mecánica a automotores.',
      wmsLayerName: 'ign:infraestructura_de_transporte_AQ170',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-estacion-de-pesaje',
      name: 'Estación de pesaje',
      description:
        'Instalación pública ubicada al costado de una vía de comunicación, provista de una báscula o balanza destinada al pesaje de vehículos de transporte.',
      wmsLayerName: 'ign:infraestructura_de_transporte_AQ180',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-rompeolas',
      name: 'Rompeolas',
      description:
        'Muro o pared de contención para la protección contra olas o mareas a lo largo de una costa, protección contra crecida en corrientes de agua y para facilitar operaciones de atraque de embarcaciones, carga, descarga, embarque.',
      wmsLayerName: 'ign:lineas_de_puertos_y_muelles_BB041',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-muelle',
      name: 'Muelle',
      description:
        'Obra construida sobre el agua, afianzada en el lecho acuático por medio de bases que la sostienen firmemente, para facilitar tareas de atraque de embarcaciones, carga, descarga, embarque.',
      wmsLayerName: 'ign:lineas_de_puertos_y_muelles_BB190',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-pista',
      name: 'Pista',
      description:
        'Calzada rectangular de tierra o asfalto, definida en un campo de aviación o aeropuerto, utilizada para despegue y aterrizaje de aeronaves.',
      wmsLayerName: 'ign:lineas_de_transporte_aereo_GB055',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-edificio-gubernamental',
      name: 'Edificio Gubernamental',
      description:
        'Construcción destinada al asiento de la autoridad oficial de un organismo nacional, provincial, municipal o comunal, y sede de actividades públicas administrativas.',
      wmsLayerName: 'ign:puntos_de_asentamientos_y_edificios_020101',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-edificio-de-comunicaciones',
      name: 'Edificio de comunicaciones',
      description:
        'Edificio público destinado a la transmisión y recepción de mensajes realizados por distintas tecnologías y medios.',
      wmsLayerName: 'ign:puntos_de_asentamientos_y_edificios_020102',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-tapera',
      name: 'Tapera',
      description:
        'Estructura no techada, parcial o totalmente destruida, que es significativa en su entorno.',
      wmsLayerName: 'ign:puntos_de_asentamientos_y_edificios_020108',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-edificacion',
      name: 'Edificación',
      description:
        'Estructura techada relativamente permanente, diseñada para algún uso particular y que no se encuentra comprendida dentro de los demás objetos geográficos del presente Catálogo.',
      wmsLayerName: 'ign:puntos_de_asentamientos_y_edificios_AL015',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-sitio-de-interes',
      name: 'Sitio de interés',
      description:
        'Lugar declarado de importancia o de interés. Incluye sitio arqueológico y sitio histórico. No incluye ruina.',
      wmsLayerName: 'ign:puntos_de_asentamientos_y_edificios_AL201',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-ruinas',
      name: 'Ruinas',
      description:
        'Construcciones semidestruidas por acción del tiempo, antrópica o acontecimiento natural, que tienen reconocido valor histórico.',
      wmsLayerName: 'ign:puntos_de_asentamientos_y_edificios_ruina',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-puerto',
      name: 'Puerto',
      description:
        'Conjunto de obras, instalaciones y servicios que proporciona el espacio necesario para la estancia de embarcaciones mientras se realizan operaciones de carga, descarga, almacenamiento de productos o materias primas y tránsito de pasajeros. ',
      wmsLayerName: 'ign:puntos_de_puertos_y_muelles_BB005',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
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
      id: 'ign-edificio-de-salud',
      name: 'Edificio de salud',
      description:
        'Conjunto de instalaciones, establecimientos e instituciones en las cuales se brindan los servicios y la atención de salud para la población. ',
      wmsLayerName: 'ign:salud_020801',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-huella',
      name: 'Huella',
      description:
        'Camino de acceso y recorrido de establecimientos en zonas rurales. Incluye caminos de poca importancia que se desprenden de caminos de tierra y los caminos demarcados en loteos para futuros barrios, entre otros.',
      wmsLayerName: 'ign:vial_AP010',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
    {
      id: 'ign-senda-rural',
      name: 'Senda rural',
      description:
        'Camino angosto de trazo sinuoso en zona rural, abierto por el tránsito de personas o animales.',
      wmsLayerName: 'ign:vial_AP050',
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
    {
      id: 'ign-red-vial-terciaria',
      name: 'Red vial terciaria',
      description:
        'Representa los objetos geográficos relativos a vías de circulación complementarios a las redes viales nacionales y provinciales.',
      wmsLayerName: 'ign:vial_terciaria',
      ...IGN_WMS_INFRASTRUCTURE_DEFAULTS,
    },
  ],
};

const IGN_WMS_HYDROGRAPHY_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-hydrography',
} as const;

export const IGN_WMS_HYDROGRAPHY_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-hydrography',
  name: 'Hidrografía (IGN)',
  description: 'Cursos de agua, lagos y características hidrográficas',
  layers: [
    {
      id: 'ign-establecimiento-agropecuario',
      name: 'Establecimiento agropecuario',
      description:
        'Lugar donde se ejerce una o varias actividades agropecuarias concentradas. Incluye agricultura intensiva o extensiva, feed lot, tambo, criadero, corral, pileta de piscicultura, haras, cabaña, granja, chacra y demás actividades relacionadas.',
      wmsLayerName: 'ign:areas_de_actividad_agropecuaria_AL270',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-embalse-rural',
      name: 'Embalse rural',
      description: 'Excavación descubierta destinada al depósito de agua en zonas rurales. ',
      wmsLayerName: 'ign:areas_de_aguas_continentales_041101',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-canal',
      name: 'Canal',
      description:
        'Excavación artificial sin flujo o con flujo controlado, construido con el objetivo de transportar agua.',
      wmsLayerName: 'ign:areas_de_aguas_continentales_BH020',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-embalse',
      name: 'Embalse',
      description:
        'Masa de agua retenida por una estructura artificial para su posterior aprovechamiento.',
      wmsLayerName: 'ign:areas_de_aguas_continentales_BH130',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-corriente-de-agua',
      name: 'Corriente de agua',
      description:
        'Flujo natural de agua que sigue los desniveles del terreno y desemboca en otra corriente de agua, en un espejo de agua o en el mar.',
      wmsLayerName: 'ign:areas_de_aguas_continentales_BH140',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-espejo-de-agua-intermitente',
      name: 'Espejo de agua intermitente',
      description:
        'Cuerpo natural o artificial de agua, dulce o salada, cuyo aporte proviene de corrientes de agua, afloramientos subterráneos o precipitaciones. Quedan excluidos los embalses y los embalses rurales.',
      wmsLayerName: 'ign:areas_de_aguas_continentales_intermitente',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-espejo-de-agua-perenne',
      name: 'Espejo de agua perenne',
      description:
        'Cuerpo natural o artificial de agua, dulce o salada, cuyo aporte proviene de corrientes de agua, afloramientos subterráneos o precipitaciones. Quedan excluidos los embalses y los embalses rurales.',
      wmsLayerName: 'ign:areas_de_aguas_continentales_perenne',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-cementerio',
      name: 'Cementerio',
      description:
        'Espacio público o privado reservado para dar sepultura. Incluye cementerio parque.',
      wmsLayerName: 'ign:areas_de_equipamiento_AL030',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-yacimiento-de-hidrocarburo',
      name: 'Yacimiento de hidrocarburo',
      description:
        'Cuerpo geológico aproximado, constituido por petróleo y/o gas, económicamente explotable.',
      wmsLayerName: 'ign:areas_de_extraccion_AA052',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-planta-potabilizadora-de-agua',
      name: 'Planta potabilizadora de agua',
      description:
        'Conjunto de instalaciones cuya función es la producción de agua para consumo humano.',
      wmsLayerName: 'ign:areas_de_fabricacion_y_procesamiento_BH220',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-relleno-sanitario',
      name: 'Relleno sanitario',
      description: 'Área destinada al depósito definitivo de desechos con tratamiento ingenieril.',
      wmsLayerName: 'ign:areas_de_gestion_de_residuos_relleno_sanitario',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-acueducto',
      name: 'Acueducto',
      description:
        'Conducto artificial que transporta agua en forma de flujo continuo con el objetivo de que esta sea accesible para su consumo u otros usos.',
      wmsLayerName: 'ign:lineas_de_aguas_continentales_BH010',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-acequia-zanja-zanjon',
      name: 'Acequia, zanja, zanjón',
      description:
        'Excavación longilínea construida en la tierra, con o sin revestimiento, con el objetivo de conducir, drenar, irrigar o controlar el agua para riego y otros usos.',
      wmsLayerName: 'ign:lineas_de_aguas_continentales_BH030',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-muro-de-embalse',
      name: 'Muro de embalse',
      description:
        'Represa construida transversalmente a una corriente de agua o canal para contener o controlar el caudal.',
      wmsLayerName: 'ign:lineas_de_aguas_continentales_BI020',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-corriente-de-agua-intermitente',
      name: 'Corriente de agua intermitente',
      description:
        'Flujo natural de agua temporario que sigue los desniveles del terreno y desemboca en otra corriente de agua, en un espejo de agua o en el mar.',
      wmsLayerName: 'ign:lineas_de_aguas_continentales_intermitentes',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-corriente-de-agua-perenne',
      name: 'Corriente de agua perenne',
      description:
        'Flujo natural de agua continua que sigue los desniveles del terreno y desemboca en otra corriente de agua, en un espejo de agua o en el mar.',
      wmsLayerName: 'ign:lineas_de_aguas_continentales_perenne',
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
    {
      id: 'ign-dique',
      name: 'Dique',
      description:
        'Terraplén natural o artificial destinado a detener o estancar el escurrimiento del agua en su curso, a los efectos de su almacenamiento para fines rurales o industriales.',
      wmsLayerName: 'ign:puntos_de_aguas_continentales_BH051',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-fuente-natural',
      name: 'Fuente natural',
      description:
        'Flujo natural de agua formado por drenaje en la superficie o por afloramiento de la freática subterránea. ',
      wmsLayerName: 'ign:puntos_de_aguas_continentales_BH170',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-catarata-cascada-salto',
      name: 'Catarata, cascada, salto',
      description:
        'Caída vertical de una corriente de agua, producida por brusco desnivel del cauce. ',
      wmsLayerName: 'ign:puntos_de_aguas_continentales_BH180',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-tanque-de-agua-elevado',
      name: 'Tanque de agua elevado',
      description:
        'Tanque para almacenamiento de agua, localizado a una distancia del suelo tal que permita la presión de agua necesaria para su distribución.',
      wmsLayerName: 'ign:puntos_de_almacenamiento_y_logistica_AM080',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-planta-de-bombeo-de-agua',
      name: 'Planta de bombeo de agua',
      description: 'Lugar que contiene bombas de achique para desagotar áreas bajas.',
      wmsLayerName: 'ign:puntos_de_estructura_asociada_AQ116',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-pozo-hidrocarburos',
      name: 'Pozo hidrocarburos',
      description:
        'Perforación hecha en la tierra o mar para la extracción de hidrocarburos líquidos o gaseosos.',
      wmsLayerName: 'ign:puntos_de_extraccion_AA050',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-estacion-de-ferrocarril',
      name: 'Estación de ferrocarril',
      description:
        'Conjunto de instalaciones edilicias y demás dependencias donde regularmente se detiene el transporte ferroviario, suben y bajan pasajeros y/o mercancías.',
      wmsLayerName: 'ign:puntos_de_transporte_ferroviario_AN070',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
    {
      id: 'ign-pajonal-juncal-totoral',
      name: 'Pajonal, juncal, totoral',
      description:
        'Área con vegetación que crece en terrenos saturados de humedad o inundados, bajos y anegadizos. Algunas especies son flotantes. ',
      wmsLayerName: 'ign:vegetacion_hidrofila_ED020',
      ...IGN_WMS_HYDROGRAPHY_DEFAULTS,
    },
  ],
};

const IGN_WMS_MARITIME_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-maritime',
} as const;

export const IGN_WMS_MARITIME_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-maritime',
  name: 'Espacios Marítimos (IGN)',
  description: 'Zonas marítimas y características náuticas',
  layers: [
    {
      id: 'ign-accidente-submarino',
      name: 'Accidente submarino',
      description:
        'Variación del relieve que se encuentra bajo el nivel mar e incluye plataformas, cuencas, fosas, dorsales, entre otros.',
      wmsLayerName: 'ign:lineas_de_mareas_y_corrientes_040601',
      ...IGN_WMS_MARITIME_DEFAULTS,
    },
    {
      id: 'ign-mareografo',
      name: 'Mareógrafo',
      description:
        'Dispositivo construido en el mar, cerca de la costa, para registrar las variaciones del nivel del agua en el tiempo. ',
      wmsLayerName: 'ign:mareas_y_corrientes_BG020',
      ...IGN_WMS_MARITIME_DEFAULTS,
    },
    {
      id: 'ign-camara-de-valvulas',
      name: 'Cámara de válvulas',
      description:
        'Lugar cercado, que en su interior se encuentran juegos de válvulas para el manejo de los fluidos del ducto que controlan.',
      wmsLayerName: 'ign:puntos_de_estructura_asociada_AA051',
      ...IGN_WMS_MARITIME_DEFAULTS,
    },
    {
      id: 'ign-200-millas-desde-la-costa-del-sector-antartico',
      name: '200 millas desde la costa del sector antártico',
      description: '200 millas desde las costas del Sector antártico',
      wmsLayerName: 'doscientas_millas_sector_antartico',
      ...IGN_WMS_MARITIME_DEFAULTS,
    },
    {
      id: 'ign-mar-territorial-argentino',
      name: 'Mar Territorial argentino',
      description:
        'Zona marítima que se extiende hasta una distancia de 12 millas marinas a partir de la línea de base.',
      wmsLayerName: 'mar_territorial_argentino',
      ...IGN_WMS_MARITIME_DEFAULTS,
    },
    {
      id: 'ign-plataforma-continental',
      name: 'Plataforma Continental',
      description:
        'Zona marítima que comprende el lecho y el subsuelo de las áreas submarinas que se extienden más allá del mar territorial y a todo lo largo de la prolongación natural del territorio hasta el borde exterior del margen continental, o bien hasta una distancia de 200 millas marinas contadas desde la línea de base, en los casos en que el borde exterior del margen continental no llegue a esa distancia.',
      wmsLayerName: 'plataforma_continental',
      ...IGN_WMS_MARITIME_DEFAULTS,
    },
  ],
};

// Geodesia
const IGN_WMS_GEODESY_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-geodesy',
} as const;

export const IGN_WMS_GEODESY_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-geodesy',
  name: 'Geodesia (IGN)',
  description: 'Redes geodésicas y puntos de control',
  layers: [
    {
      id: 'ign-red-gravimetrica-bacara',
      name: 'Red gravimétrica BACARA',
      description: '',
      wmsLayerName: 'ign:gravimetria_bacara',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-igsn-71',
      name: 'Red gravimétrica IGSN 71',
      description: 'International Gravity Standardization Net 1971',
      wmsLayerName: 'ign:gravimetria_igsn71',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-raga',
      name: 'Red gravimétrica RAGA',
      description: '',
      wmsLayerName: 'ign:gravimetria_raga',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-de-primer-orden',
      name: 'Red gravimétrica de Primer Orden',
      description: '',
      wmsLayerName: 'ign:gravimetria_rpo',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-de-segundo-orden',
      name: 'Red gravimétrica de Segundo Orden',
      description: '',
      wmsLayerName: 'ign:gravimetria_rso',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-gravimetrica-de-tercer-orden',
      name: 'Red gravimétrica de Tercer Orden',
      description: '',
      wmsLayerName: 'ign:gravimetria_rto',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-de-nivelacion-de-alta-precision',
      name: 'Red de nivelación de Alta Precisión',
      description: '',
      wmsLayerName: 'ign:nivelacion_alta_precision',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-de-nivelacion-de-precision',
      name: 'Red de nivelación de Precisión',
      description: '',
      wmsLayerName: 'ign:nivelacion_precision',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-de-nivelacion-topografica',
      name: 'Red de nivelación Topográfica',
      description: '',
      wmsLayerName: 'ign:nivelacion_topografica',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-de-estaciones-gpsgnss-ramsac',
      name: 'Red de estaciones GPS/GNSS RAMSAC',
      description:
        'Red de estaciones GPS/GNSS permanentes que poseen coordenadas en el Marco de Referencia Geodésico Nacional POSGAR 2007. Esta red es denominada Red Argentina de Monitoreo Satelital Continuo (RAMSAC).',
      wmsLayerName: 'ign:ramsac',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-ramsac-ntrip',
      name: 'Red RAMSAC-NTRIP',
      description: '',
      wmsLayerName: 'ign:ramsac_ntrip',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-geodesica-densificacion-posgar07',
      name: 'Red geodésica Densificación POSGAR07',
      description: '',
      wmsLayerName: 'ign:red_densificacion_posgar',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
    {
      id: 'ign-red-geodesica-posgar07',
      name: 'Red geodésica POSGAR07',
      description: '',
      wmsLayerName: 'ign:red_posgar',
      ...IGN_WMS_GEODESY_DEFAULTS,
    },
  ],
};

const IGN_WMS_DEFENSE_SECURITY_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-defense-security',
} as const;

export const IGN_WMS_DEFENSE_SECURITY_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-defense-security',
  name: 'Defensa y Seguridad (IGN)',
  description: 'Infraestructura de defensa y seguridad',
  layers: [
    {
      id: 'ign-limite-de-zona-de-frontera',
      name: 'Límite de Zona de Frontera',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita la Zona de Frontera.',
      wmsLayerName: 'ign:linea_de_limite_070112',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-zona-de-frontera-area',
      name: 'Zona de Frontera área',
      description:
        'Zona adyacente al límite internacional, que constituye una zona de seguridad destinada a complementar las previsiones territoriales de la defensa nacional y/o un área prioritaria para su desarrollo.',
      wmsLayerName: 'ign:zona_de_frontera',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-complejos-fronterizos',
      name: 'Complejos Fronterizos',
      description:
        'El Complejo Fronterizo (CF) hace referencia al predio en el que se emplazan uno o varios recintos y equipamientos, tanto organizativos como de procedimientos, públicos y privados, destinados a la vigilancia y control de personas, bienes transportados y medios de transporte, para cruzar los límites de dos países, previo al cumplimiento de los requisitos impuestos por las autoridades nacionales de cada uno de ellos. ',
      wmsLayerName: 'complejos_fronterizos',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-institucion-penitenciaria',
      name: 'Institución penitenciaria',
      description:
        'Conjunto de instalaciones destinadas al cumplimiento de las penas previstas en las sentencias judiciales, penas pecuniarias (multas) o pena de privación de ciertos derechos.',
      wmsLayerName: 'estructuras_operativas_y_defensivas_090101',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-cuartel-de-bomberos',
      name: 'Cuartel de bomberos',
      description:
        'Estructura preparada para almacenar el equipamiento necesario para apagar fuegos, incluyendo mangueras, vehículos, equipos de protección del personal, extintores de fuego, entre otros. Incluye instalaciones anexas.',
      wmsLayerName: 'estructuras_operativas_y_defensivas_090102',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-edificio-de-seguridad',
      name: 'Edificio de seguridad',
      description:
        'Conjunto de instalaciones, establecimientos o instituciones destinadas a seguridad de la población.',
      wmsLayerName: 'estructuras_operativas_y_defensivas_FA517',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-pasos-de-fronteras-internacionales',
      name: 'Pasos de Fronteras Internacionales',
      description:
        'Paso de Frontera Internacional (PFI) identifica un punto de entrada y salida de personas, mercaderías y medios de transporte, que vincula de manera directa (por medios fluviales o terrestres) a la República Argentina con los cinco países vecinos. Quedan exceptuados el Puerto de Buenos Aires, todos los Aeropuertos, los puertos ubicados sobre la Hidrovía y los puertos Marítimos.',
      wmsLayerName: 'pasos_de_fronteras_internacionales',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-area-de-desarrollo-de-fronteras',
      name: 'Área de Desarrollo de Fronteras',
      description: 'Área destinada a su desarrollo adyacente al límite internacional.',
      wmsLayerName: 'area_de_desarrollo_de_fronteras',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
    {
      id: 'ign-zona-de-seguridad-de-frontera',
      name: 'Zona de Seguridad de Frontera',
      description:
        'Zona adyacente al límite internacional, que constituye una zona de seguridad destinada a complementar las previsiones territoriales de la defensa nacional y/o un área prioritaria para su desarrollo.',
      wmsLayerName: 'zona_de_frontera_070113',
      wmsWorkspace: 'limites',
      ...IGN_WMS_DEFENSE_SECURITY_DEFAULTS,
    },
  ],
};

// Relieve
const IGN_WMS_RELIEF_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-relief',
} as const;

export const IGN_WMS_RELIEF_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-relief',
  name: 'Relieve (IGN)',
  description: 'Relieve y topografía',
  layers: [
    {
      id: 'ign-modelo-digital-de-elevaciones',
      name: 'Modelo Digital de Elevaciones',
      description: 'Cobertura de los modelos digitales de elevación (MDE)',
      wmsLayerName: 'ign:mde',
      ...IGN_WMS_RELIEF_DEFAULTS,
    },
    {
      id: 'ign-terreno-para-cultivo',
      name: 'Terreno para cultivo',
      description:
        'Terreno destinado a la siembra de cereales, hortalizas u otros vegetales que no son permanentes, y que pueden rotar de un año a otro. Incluye terreno en barbecho.',
      wmsLayerName: 'ign:terreno_para_cultivo_EA010',
      ...IGN_WMS_RELIEF_DEFAULTS,
    },
  ],
};

const IGN_WMS_VEGETATION_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-vegetation',
} as const;

export const IGN_WMS_VEGETATION_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-vegetation',
  name: 'Vegetación (IGN)',
  description: 'Cobertura vegetal',
  layers: [
    {
      id: 'ign-molino-viento',
      name: 'Molino viento',
      description:
        'Artefacto o máquina que sirve para extracción de agua utilizando la energía del viento.',
      wmsLayerName: 'ign:puntos_de_actividad_agropecuaria_AJ050',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
    {
      id: 'ign-desmonte',
      name: 'Desmonte',
      description:
        'Área en la que la vegetación ha sido eliminada artificialmente para desarrollar diferentes actividades. Posteriormente puede dedicarse a la agricultura. Por lo general, es de contornos regulares.',
      wmsLayerName: 'ign:sin_vegetacion_061001',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
    {
      id: 'ign-bosque-artificial',
      name: 'Bosque artificial',
      description:
        'Área cerrada o abierta con árboles implantados de bajo, mediano o gran porte. No incluye las áreas de reserva.',
      wmsLayerName: 'ign:vegetacion_arborea_060301',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
    {
      id: 'ign-monte',
      name: 'Monte',
      description:
        'Superficie cubierta por hierbas, arbustos y árboles de no más de 5 metros de altura, de menor densidad de cobertura que en el caso del bosque.',
      wmsLayerName: 'ign:vegetacion_arborea_060302',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
    {
      id: 'ign-parque-artificial',
      name: 'Parque artificial',
      description:
        'Área con vegetación implantada con diferentes especies autóctonas y alóctonas, cuyo sentido es crear un área para esparcimiento.',
      wmsLayerName: 'ign:vegetacion_arborea_AK120',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
    {
      id: 'ign-bosque-selva',
      name: 'Bosque, selva',
      description:
        'Área cerrada o abierta con árboles naturales de importante densidad, de bajo, mediano o gran porte.',
      wmsLayerName: 'ign:vegetacion_arborea_EC015',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
    {
      id: 'ign-estepa-arbustiva',
      name: 'Estepa arbustiva',
      description:
        'Área con asociación de arbustos bajos, de tallos finos y con baja densidad de cobertura que puede dejar claros. Se encuentran ejemplos en Patagonia. ',
      wmsLayerName: 'ign:vegetacion_arbustiva_EB015',
      ...IGN_WMS_VEGETATION_DEFAULTS,
    },
  ],
};

// Otros
const IGN_WMS_OTHER_DEFAULTS = {
  ...IGN_WMS_DEFAULTS,
  subgroupId: 'ign-other',
} as const;

export const IGN_WMS_OTHER_SUBGROUP: LayerSubgroup = {
  ...IGN_GROUP_DEFAULTS,
  id: 'ign-other',
  name: 'Otros (IGN)',
  description: 'Otras capas temáticas',
  layers: [
    {
      id: 'ign-boya',
      name: 'Boya',
      description:
        'Señalización flotante fondeada en el mar o corriente de agua con el objeto de indicar un lugar de peligro para la navegación, señalar la derrota que debe seguir un buque, como así también cualquier otra indicación especial.',
      wmsLayerName: 'ign:ayuda_a_la_navegacion_BC020',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-faro',
      name: 'Faro',
      description:
        'Estructura distintiva ubicada dentro o fuera de la costa, peñasco o flotante. Tiene características diurnas individuales particulares para la navegación de día, y luz en su parte superior para servir como ayuda a la navegación nocturna.',
      wmsLayerName: 'ign:ayuda_a_la_navegacion_BC050',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-baliza',
      name: 'Baliza',
      description:
        'Señalización fija montada en la costa que se coloca como marca a los efectos de señalar el lugar, rumbo y enfilación que debe seguir una embarcación.',
      wmsLayerName: 'ign:ayuda_a_la_navegacion_BC101',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-base-antartica',
      name: 'Base antártica',
      description:
        'Conjunto de instalaciones destinadas a fines científicos ubicadas en el Continente Antártico.',
      wmsLayerName: 'ign:bahra_base_antartica',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-paraje',
      name: 'Paraje',
      description:
        'Lugar situado en un área rural que se identifica con un topónimo, usualmente de límites no definidos, donde puede habitar población en forma permanente o temporaria.',
      wmsLayerName: 'ign:bahra_paraje',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cartas-1100000',
      name: 'Cartas 1:100.000',
      description:
        'Cobertura de cartas topográficas a escala 1:100.000 que representan el relieve del terreno y la ubicación de los elementos naturales y artificiales ubicados sobre el mismo.',
      wmsLayerName: 'ign:cartas_100000',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cartas-1250000',
      name: 'Cartas 1:250.000',
      description:
        'Cobertura de cartas topográficas a escala 1:250.000 que representan el relieve del terreno y la ubicación de los elementos naturales y artificiales ubicados sobre el mismo.',
      wmsLayerName: 'ign:cartas_250000',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cartas-150000',
      name: 'Cartas 1:50.000',
      description:
        'Cobertura de cartas topográficas a escala 1:50.000 que representan el relieve del terreno y la ubicación de los elementos naturales y artificiales ubicados sobre el mismo.',
      wmsLayerName: 'ign:cartas_50000',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cartas-1500000',
      name: 'Cartas 1:500.000',
      description:
        'Cobertura de cartas topográficas a escala 1:500.000 que representan el relieve del terreno y la ubicación de los elementos naturales y artificiales ubicados sobre el mismo.',
      wmsLayerName: 'ign:cartas_500000',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-puesto-de-control',
      name: 'Puesto de Control',
      description:
        'Conjunto de instalaciones para controlar el paso, declarar y/o inspeccionar los bienes, vehículos y/o personas.',
      wmsLayerName: 'ign:controles_AH070',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-afloramiento-rocoso',
      name: 'Afloramiento rocoso',
      description:
        'Manifestación en superficie de alguna litología de cualquier tipo y composición. Incluye macizo rocoso.',
      wmsLayerName: 'ign:edafologia_afloramiento_rocoso',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-arenal',
      name: 'Arenal',
      description:
        'Suelo constituido por sedimento suelto, tamaño arena, sin tener la forma de médano y acumulado por el viento. Incluye el arenal con ripio.',
      wmsLayerName: 'ign:edafologia_arenal',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-barrial-barrizal',
      name: 'Barrial, Barrizal',
      description:
        'El barrial o barreal es un terreno bajo y sin desagüe que se inunda periódicamente formando un lodo gredoso y sin vegetación que cuando se seca por evaporación se transforma en un polvillo fino esparcido por el viento. El barrizal es un sitio lleno de barro permanente o durante o durante la mayor parte del año. El guadal es un pantano arenoso, de nula capacidad portante y poca vegetación.',
      wmsLayerName: 'ign:edafologia_barrial_barrizal',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cumbre-rocosa',
      name: 'Cumbre rocosa',
      description:
        'Corresponde a una cima coronada por un afloramiento rocoso, de cualquier naturaleza, generalmente escarpada, lo cual no permite su representación altimétrica por curvas de nivel.',
      wmsLayerName: 'ign:edafologia_cumbre_rocosa',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-pedregal',
      name: 'Pedregal',
      description:
        'Terreno cubierto de rocas sueltas, de tamaño mayor a la grava, generalmente angulosas y heterogéneas en cuanto a composición y tamaño.',
      wmsLayerName: 'ign:edafologia_pedregal',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-salina-salar-salitral-boratera',
      name: 'Salina, Salar, Salitral, Boratera',
      description:
        'Zona baja arreica donde se produce acumulación de sales por evaporación (cloruros y sulfatos principalmente), constituyendo un depósito natural de sales, cuya denominación varía según el tipo de sal. Salina o salar se refiere a la acumulación de sales en solución acuosa. Salitral es el depósito natural de salitre. Boratera es una salina donde la sal predominante es borato.',
      wmsLayerName: 'ign:edafologia_salina',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-instalacion-militar',
      name: 'Instalación militar',
      description:
        'Conjunto de instalaciones destinadas al asentamiento de paz de las Fuerzas Armadas.',
      wmsLayerName: 'ign:instalacion_militar_SU001',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-puente',
      name: 'Puente',
      description:
        'Estructura que asegura la continuidad de una vía de transporte (ejemplo: red vial, calle, ferrocarril) por sobre un obstáculo natural o artificial del terreno (ejemplo: corriente de agua, canal, entre otros). ',
      wmsLayerName: 'ign:lineas_de_cruces_y_enlaces_AQ040',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-linea-de-transmision-electrica',
      name: 'Línea de transmisión eléctrica',
      description:
        ' Sistema de cableado compuesto por torres y cables que transmite o distribuye energía eléctrica.',
      wmsLayerName: 'ign:lineas_de_energia_AT030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-ducto',
      name: 'Ducto',
      description:
        'Serie de tubos conectados para el transporte de sólidos, líquidos o gases por bombeo. Se excluyen los acueductos.',
      wmsLayerName: 'ign:lineas_de_estructura_asociada_ducto_subterraneo',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-sierra',
      name: 'Sierra',
      description:
        'Secuencia eslabonada de cerros que en conjunto presentan disposición longilínea y altitudes intermedias entre la cordillera y montañas. Incluye serranía, entendida como una extensión sinónima de sierra, paramillo, cerrillo, bordo, puntilla, nevado, entre otros.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_050204',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cordillera',
      name: 'Cordillera',
      description:
        'Secuencia eslabonada de cadenas orográficas de considerable altura con una disposición homogénea y pertenecientes al mismo proceso orogénico.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_050205',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cordon',
      name: 'Cordón',
      description:
        'Grupo de elevaciones con disposición orográfica similar e igual orogenia, que forman parte de una cordillera o sistema montañoso. ',
      wmsLayerName: 'ign:lineas_de_geomorfologia_050206',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cuchilla',
      name: 'Cuchilla',
      description:
        'Elevación de poca altura, alargada y estrecha, con cumbre convexa y con pendientes suaves hacia el llano. Incluye loma, lomada, entre otros.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_050207',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cuesta',
      name: 'Cuesta',
      description:
        'Parte de un relieve constituido por dos pendientes asimétricas, una abrupta y escarpada (cuesta propiamente dicha) y la opuesta, de suave inclinación.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_050208',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-lineashipsometricas',
      name: 'lineas_hipsometricas',
      description:
        'Línea que une puntos que tienen el mismo valor de altitud respecto al nivel medio del mar. También se la denomina isohipsa o curva hipsométrica.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_CA010',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-filo',
      name: 'Filo',
      description:
        'Cima de un cordón montañoso agudo, que es divisoria de aguas. Incluye silleta, entre otros.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_CA020',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-valle',
      name: 'Valle',
      description:
        'Forma de erosión fluvial cuyas laderas tienen alturas, pendientes y profundidades diversas. Incluye bolsón, entre otros.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_CA025',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-lugar-geomorfologico',
      name: 'Lugar geomorfológico',
      description: 'Geoforma caracterizada por la acción de algún agente geomorfológico. ',
      wmsLayerName: 'ign:lineas_de_geomorfologia_DB001',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-quebrada-canadon-garganta',
      name: 'Quebrada, cañadón, garganta',
      description:
        'Valle de paredes abruptas más o menos profundo que generalmente puede estar surcado por una corriente de agua permanente o temporario. Incluye cajón, desfiladero, entre otros.',
      wmsLayerName: 'ign:lineas_de_geomorfologia_DB200',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-barranca',
      name: 'Barranca',
      description:
        'Desnivel pronunciado del terreno con pendiente variable y de origen diverso. En el caso de costa marina se denomina acantilado. En el caso de origen fluvial se denomina barranca. Si se encuentra en terreno no anexo a una corriente de agua o mar se denomina escarpa o barda. ',
      wmsLayerName: 'ign:lineas_de_geomorfologia_barranca',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-plantacion-permanente',
      name: 'Plantación permanente',
      description:
        'Terreno dedicado a una actividad agraria que implica un uso permanente del espacio geográfico, o por un largo lapso de tiempo.',
      wmsLayerName: 'ign:plantacion_permanente_KB025',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-tanque-de-combustible',
      name: 'Tanque de combustible',
      description:
        'Depósito destinado a almacenar combustibles líquidos o gaseosos para su posterior utilización.',
      wmsLayerName: 'ign:puntos_de_almacenamiento_y_logistica_AM070',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-establecimiento-educativo',
      name: 'Establecimiento educativo',
      description:
        'Edificio diseñado y equipado para realizar actividades educativas de nivel inicial, primario, secundario, polimodal, terciario o universitario, sea de gestión estatal o privada. Tiene en cuenta la educación común, especial y de adultos.',
      wmsLayerName: 'ign:puntos_de_ciencia_y_educacion_020601',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-universidad',
      name: 'Universidad',
      description:
        'Conjunto de unidades educativas de enseñanza superior. Puede ser de gestión estatal o privada.',
      wmsLayerName: 'ign:puntos_de_ciencia_y_educacion_020602',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-centro-cientifico',
      name: 'Centro Científico',
      description:
        'Conjunto de instalaciones destinadas a realizar investigaciones científicas. Incluye observatorio astronómico, polo científico y tecnológico, entre otros.',
      wmsLayerName: 'ign:puntos_de_ciencia_y_educacion_AL295',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-antena',
      name: 'Antena',
      description:
        'Dispositivo diseñado con el objetivo de emitir o recibir ondas electromagnéticas. Está ubicado sobre el suelo.',
      wmsLayerName: 'ign:puntos_de_comunicacion_AT010',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-torre-de-telecomunicaciones',
      name: 'Torre de telecomunicaciones',
      description:
        'Estructura metálica de gran altura que se utiliza para sostener antenas con fines de transmisión o recepción de ondas electromagnéticas. ',
      wmsLayerName: 'ign:puntos_de_comunicacion_AT080',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-alcantarilla',
      name: 'Alcantarilla',
      description:
        'Estructura ingenieril en forma tubular o en bóveda que se encuentra asociada a la red de transporte y que permite el cruce de una corriente de agua u otro obstáculo.',
      wmsLayerName: 'ign:puntos_de_cruces_y_enlaces_AQ065',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-tunel',
      name: 'Tunel',
      description:
        'Paso subterráneo abierto artificialmente para establecer una comunicación a través de una montaña, por debajo de una corriente de agua u otro obstáculo.',
      wmsLayerName: 'ign:puntos_de_cruces_y_enlaces_AQ130',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-vado',
      name: 'Vado',
      description:
        'Lugar en una corriente de agua o espejo de agua con lecho más o menos firme y poco profundo, por donde es posible pasar a pie, caballo o vehículo.',
      wmsLayerName: 'ign:puntos_de_cruces_y_enlaces_BH070',
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
      id: 'ign-planta-transformadora',
      name: 'Planta transformadora',
      description:
        'Planta que se encuentra junto a las centrales generadoras o en la periferia de las diversas zonas de consumo, donde se transforma la tensión de la energía eléctrica.',
      wmsLayerName: 'ign:puntos_de_energia_AD030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-refugio',
      name: 'Refugio',
      description:
        'Estructura destinada a dar albergue eventual en zonas con condiciones adversas.',
      wmsLayerName: 'ign:puntos_de_equipamiento_AH030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-monumento',
      name: 'Monumento',
      description:
        'Obra arquitectónica o artística, sea conmemorativa o histórica. Incluye estatua, fuente, busto, inscripción, monolito y calvario, entre otros.',
      wmsLayerName: 'ign:puntos_de_equipamiento_AL130',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-galpon-tinglado',
      name: 'Galpón, tinglado',
      description:
        'Lugar cubierto, cerrado o abierto por un o más lados destinado al almacenamiento de productos o maquinaria.',
      wmsLayerName: 'ign:puntos_de_estructura_asociada_AJ080',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-mina',
      name: 'Mina',
      description:
        'Sitio destinado a la extracción de minerales metalíferos y no metalíferos por galerías subterráneas o a cielo abierto. ',
      wmsLayerName: 'ign:puntos_de_extraccion_AA010',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-fabrica',
      name: 'Fábrica',
      description:
        'Conjunto de instalaciones donde se realiza una serie de actividades técnicas destinadas a producir bienes materiales transformando materias primas. Incluye planta de ensamble. No incluye astillero.',
      wmsLayerName: 'ign:puntos_de_fabricacion_y_procesamiento_AC000',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-mogote',
      name: 'Mogote',
      description: 'Elevación del terreno, cónica, aislada, y con su parte superior trunca.',
      wmsLayerName: 'ign:puntos_de_geomorfologia_050203',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-punto-acotado',
      name: 'Punto acotado',
      description:
        'Punto del terreno que ha sido medido altimétricamente y no está materializado en el terreno.',
      wmsLayerName: 'ign:puntos_de_geomorfologia_CA030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-abra-paso-portillo-portezuelo',
      name: 'Abra, paso, portillo, portezuelo',
      description:
        'Depresión del terreno entre dos alturas o cerros, que constituye un portal en unos casos o simplemente una puerta de paso a valles situados a ambos lados.',
      wmsLayerName: 'ign:puntos_de_geomorfologia_DB120',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-cerro',
      name: 'Cerro',
      description:
        'Elevación que sobresale de los lineamientos serranos o montañosos. Incluye monte, morro, nevado, pico, volcán. El nevado es un cerro de gran altura que posee nieves perpetuas en su cumbre y permanece blanco durante todo el año. Un pico es una elevación montañosa, de cumbre aguda y puntiaguda con flancos escarpados. Un volcán es una abertura o grieta de la superficie terrestre, a través de la cual ascienden la lava o magma y gases que provienen de zonas profundas y que liberan importantes cantidades de energía térmica y cinética. También incluye loma, peña, bordo, alto, bajo, colina, entre otros.',
      wmsLayerName: 'ign:puntos_de_geomorfologia_NA100',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-glaciar',
      name: 'Glaciar',
      description:
        'Masa de hielo permanente y en movimiento, alimentada desde un ventisquero y que en forma de lengua ocupa un valle moviéndose cuesta abajo. También incluye glaciar de circo.',
      wmsLayerName: 'ign:puntos_de_glaciologia_BJ030',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-roca',
      name: 'Roca',
      description:
        'Agregado de una o más variedades de minerales, en estado sólido, de gran tamaño, que constituye un peligro para la navegación.',
      wmsLayerName: 'ign:puntos_de_obstrucciones_BD130',
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
    {
      id: 'ign-instalacion-deportiva-y-de-esparcimiento',
      name: 'Instalación deportiva y de esparcimiento',
      description:
        'Conjunto de instalaciones destinadas al desarrollo de actividades sociales, recreativas y deportivas. Hace referencia a club, balneario, polígono de tiro, conjunto de canchas, campo de golf, campo de polo, pista de carreras, estadio, entre otros. ',
      wmsLayerName: 'ign:puntos_de_recreacion_AK040',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
    {
      id: 'ign-red-geodesica-pasma',
      name: 'Red geodésica PASMA',
      description: 'Proyecto de Asistencia al Sector Minero',
      wmsLayerName: 'ign:red_pasma',
      ...IGN_WMS_OTHER_DEFAULTS,
    },
  ],
};
