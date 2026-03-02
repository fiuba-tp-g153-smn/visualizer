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
    name: 'ArgenMAP (IGN)',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">IGN</a>',
    maxZoom: 19,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: getTmsY(BASE_MAP_PREVIEW_CONFIG.y, BASE_MAP_PREVIEW_CONFIG.z),
  },

  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },

  satellite: {
    id: 'satellite',
    name: 'Satélite (ESRI)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },

  cartoDB: {
    id: 'cartoDB',
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
  },

  cartoDBDark: {
    id: 'cartoDBDark',
    name: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
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
