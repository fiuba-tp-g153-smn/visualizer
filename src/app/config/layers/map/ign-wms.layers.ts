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
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-provincial',
      name: 'Límites Provinciales',
      description: 'Límites entre provincias',
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-limite-departamental',
      name: 'Límites Departamentales',
      description: 'Límites entre departamentos',
      type: LayerType.WMS,
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
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-vias-nacionales',
      name: 'Rutas Nacionales',
      description: 'Red vial nacional',
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-vias-provinciales',
      name: 'Rutas Provinciales',
      description: 'Red vial provincial',
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-ferrocarriles',
      name: 'Ferrocarriles',
      description: 'Red ferroviaria',
      type: LayerType.WMS,
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
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
    {
      id: 'ign-puertos',
      name: 'Puertos',
      description: 'Puertos marítimos y fluviales',
      type: LayerType.WMS,
      category: LayerCategory.IGN_WMS,
      ...IGN_WMS_DEFAULTS,
    },
  ].filter((layer) => !environment.ui.disabledLayers.includes(layer.id)),
};
