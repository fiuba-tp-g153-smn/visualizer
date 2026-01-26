import { LayerSubgroup, LayerType, LayerCategory } from '../../../models';
import { environment } from '../../../../environments/environment';

/**
 * Valores por defecto para capas WMS del IGN
 */
const IGN_WMS_DEFAULTS = {
  visible: false,
  opacity: 70,
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
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-provincial',
      name: 'Límites Provinciales',
      description: 'Límites entre provincias',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-departamental',
      name: 'Límites Departamentales',
      description: 'Límites entre departamentos',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-provincias',
      name: 'Provincias',
      description: 'Polígonos de provincias argentinas',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-municipios',
      name: 'Municipios',
      description: 'Municipios de Argentina',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
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
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-vias-nacionales',
      name: 'Rutas Nacionales',
      description: 'Red vial nacional',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-vias-provinciales',
      name: 'Rutas Provinciales',
      description: 'Red vial provincial',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-ferrocarriles',
      name: 'Ferrocarriles',
      description: 'Red ferroviaria',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-rios-perennes',
      name: 'Ríos Perennes',
      description: 'Cursos de agua permanentes',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-cuerpos-agua',
      name: 'Cuerpos de Agua',
      description: 'Lagos, lagunas y embalses',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
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
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-puertos',
      name: 'Puertos',
      description: 'Puertos marítimos y fluviales',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-pasos-fronterizos',
      name: 'Pasos Fronterizos',
      description: 'Pasos de frontera internacionales',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-hitos-internacionales',
      name: 'Hitos Internacionales',
      description: 'Hitos de límite internacional',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};

export const IGN_WMS_PROTECTED_AREAS_SUBGROUP: LayerSubgroup = {
  id: 'ign-protected',
  name: 'Áreas Protegidas (IGN)',
  description: 'Parques nacionales y áreas protegidas',
  expanded: false,
  layers: [
    {
      id: 'ign-parques-nacionales',
      name: 'Parques Nacionales',
      description: 'Sistema de parques nacionales',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-reservas-naturales',
      name: 'Reservas Naturales',
      description: 'Áreas naturales protegidas',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};

export const IGN_WMS_CARTOGRAPHY_SUBGROUP: LayerSubgroup = {
  id: 'ign-cartography',
  name: 'Cartografía (IGN)',
  description: 'Elementos cartográficos',
  expanded: false,
  layers: [
    {
      id: 'ign-curvas-nivel',
      name: 'Curvas de Nivel',
      description: 'Líneas de elevación',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-grilla-coordenadas',
      name: 'Grilla de Coordenadas',
      description: 'Grilla geográfica',
      type: LayerType.RASTER,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
