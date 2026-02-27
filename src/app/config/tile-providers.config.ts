/**
 * Configuración de proveedores de tiles (mapas base)
 */

import { TileProvider } from '../models';

/**
 * Configuración de coordenadas para las previews de tiles
 * Ajustar estos valores para centrar las previews en Argentina
 */
export const TILE_PREVIEW_CONFIG = {
  z: 2,
  x: 1,
  y: 2,
};

/**
 * Convierte coordenadas Y estándar a coordenadas Y de TMS
 * En TMS, Y está invertido: tms_y = (2^zoom - 1) - y
 */
function getTmsY(y: number, zoom: number): number {
  return Math.pow(2, zoom) - 1 - y;
}

/**
 * Proveedores de tiles disponibles
 */
export const TILE_PROVIDERS: Record<string, TileProvider> = {
  argenmap: {
    id: 'argenmap',
    name: 'ArgenMAP (IGN)',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">IGN</a>',
    maxZoom: 19,
    previewZ: TILE_PREVIEW_CONFIG.z,
    previewX: TILE_PREVIEW_CONFIG.x,
    previewY: getTmsY(TILE_PREVIEW_CONFIG.y, TILE_PREVIEW_CONFIG.z), // Convierte Y estándar a TMS
  },

  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    previewZ: TILE_PREVIEW_CONFIG.z,
    previewX: TILE_PREVIEW_CONFIG.x,
    previewY: TILE_PREVIEW_CONFIG.y,
  },

  satellite: {
    id: 'satellite',
    name: 'Satélite (ESRI)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
    previewZ: TILE_PREVIEW_CONFIG.z,
    previewX: TILE_PREVIEW_CONFIG.x,
    previewY: TILE_PREVIEW_CONFIG.y,
  },

  cartoDB: {
    id: 'cartoDB',
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    previewZ: TILE_PREVIEW_CONFIG.z,
    previewX: TILE_PREVIEW_CONFIG.x,
    previewY: TILE_PREVIEW_CONFIG.y,
  },

  cartoDBDark: {
    id: 'cartoDBDark',
    name: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    previewZ: TILE_PREVIEW_CONFIG.z,
    previewX: TILE_PREVIEW_CONFIG.x,
    previewY: TILE_PREVIEW_CONFIG.y,
  },
} as const;

/**
 * Obtener un proveedor por su ID
 */
export function getTileProvider(id: string): TileProvider {
  const provider = TILE_PROVIDERS[id];
  if (!provider) {
    throw new Error(`Tile provider '${id}' not found`);
  }
  return provider;
}

/**
 * Obtener lista de todos los proveedores
 */
export function getAllTileProviders(): TileProvider[] {
  return Object.values(TILE_PROVIDERS);
}
