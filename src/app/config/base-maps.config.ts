/**
 * Base map configuration
 *
 * Defines available base map styles and their tile sources.
 * Each base map provides different visualizations (street maps, satellite imagery, etc.)
 */

import { BaseMap } from '../models';

/**
 * Preview tile coordinates configuration
 * Adjust these values to center previews on Argentina
 */
export const BASE_MAP_PREVIEW_CONFIG = {
  z: 2,
  x: 1,
  y: 2,
};

/**
 * Converts standard Y coordinates to TMS Y coordinates
 * In TMS, Y is inverted: tms_y = (2^zoom - 1) - y
 */
function getTmsY(y: number, zoom: number): number {
  return Math.pow(2, zoom) - 1 - y;
}

/**
 * Available base map configurations
 */
export const BASE_MAPS: Record<string, BaseMap> = {
  argenmap: {
    id: 'argenmap',
    name: 'Argenmap',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a> + <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 3,
    maxZoom: 21,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: getTmsY(BASE_MAP_PREVIEW_CONFIG.y, BASE_MAP_PREVIEW_CONFIG.z),
  },

  argenmapGris: {
    id: 'argenmapGris',
    name: 'Argenmap gris',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a>',
    minZoom: 3,
    maxZoom: 21,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: getTmsY(BASE_MAP_PREVIEW_CONFIG.y, BASE_MAP_PREVIEW_CONFIG.z),
  },

  argenmapOscuro: {
    id: 'argenmapOscuro',
    name: 'Argenmap oscuro',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a>',
    minZoom: 3,
    maxZoom: 21,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: getTmsY(BASE_MAP_PREVIEW_CONFIG.y, BASE_MAP_PREVIEW_CONFIG.z),
  },

  argenmapTopografico: {
    id: 'argenmapTopografico',
    name: 'Argenmap topográfico',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a>',
    minZoom: 3,
    maxZoom: 21,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: getTmsY(BASE_MAP_PREVIEW_CONFIG.y, BASE_MAP_PREVIEW_CONFIG.z),
  },

  satellite: {
    id: 'satellite',
    name: 'Imágenes satelitales Esri',
    url: 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    minZoom: 3,
    maxZoom: 17,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },

  topographic: {
    id: 'topographic',
    name: 'Mapa topográfico Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    minZoom: 3,
    maxZoom: 8,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },

  googleSatellite: {
    id: 'googleSatellite',
    name: 'Imágenes satelitales Google',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google',
    minZoom: 3,
    maxZoom: 20,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },

  oceanBase: {
    id: 'oceanBase',
    name: 'Mapa Esri Fondo Oceánico',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    minZoom: 3,
    maxZoom: 16,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },
} as const;

/**
 * Get a base map configuration by ID
 * @throws {Error} If base map ID is not found
 */
export function getBaseMap(id: string): BaseMap {
  const baseMap = BASE_MAPS[id];
  if (!baseMap) {
    throw new Error(`Base map '${id}' not found`);
  }
  return baseMap;
}

/**
 * Get all available base map configurations
 */
export function getAllBaseMaps(): BaseMap[] {
  return Object.values(BASE_MAPS);
}
