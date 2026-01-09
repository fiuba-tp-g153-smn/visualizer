/**
 * Configuración de proveedores de tiles (mapas base)
 */

import { TileProvider } from '../models';

/**
 * Proveedores de tiles disponibles
 */
export const TILE_PROVIDERS: Record<string, TileProvider> = {
  argenmap: {
    id: 'argenmap',
    name: 'ArgenMAP (IGN)',
    url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    attribution:
      '<a href="http://leafletjs.com">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">IGN</a>',
    maxZoom: 19,
  },

  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },

  satellite: {
    id: 'satellite',
    name: 'Satélite (ESRI)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },

  cartoDB: {
    id: 'cartoDB',
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },

  cartoDBDark: {
    id: 'cartoDBDark',
    name: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
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
