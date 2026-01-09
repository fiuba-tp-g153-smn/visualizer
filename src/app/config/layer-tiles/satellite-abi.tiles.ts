import { buildTileUrl, BACKEND_CONFIG } from '../backend.config';
import * as L from 'leaflet';

/**
 * Configuración de tiles satelitales ABI
 */

/**
 * Opciones comunes para tiles satelitales procesados con gdal2tiles
 */
const SATELLITE_TILE_OPTIONS: L.TileLayerOptions = {
  minNativeZoom: 4,
  maxNativeZoom: 8,
  minZoom: 0,
  maxZoom: 18,
  tms: true, // gdal2tiles usa TMS
  bounds: [
    [-55.0, -74.0], // Sur-oeste Argentina
    [-21.0, -53.0], // Norte-este Argentina
  ],
  noWrap: true,
};

/**
 * URLs mock usando CartoDB con diferentes estilos para testing
 */
const MOCK_URLS: Record<string, string> = {
  'abi-ch2': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  'abi-ch9': 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  'abi-ch13': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

/**
 * Obtiene URL y opciones para un tile layer ABI
 */
export function getAbiTileConfig(layerId: string): {
  url: string;
  options: L.TileLayerOptions;
} {
  const url = BACKEND_CONFIG.useMockTiles ? MOCK_URLS[layerId] : buildTileUrl(layerId);

  const options = BACKEND_CONFIG.useMockTiles
    ? { attribution: `Mock: Canal ABI ${layerId}` }
    : { ...SATELLITE_TILE_OPTIONS, attribution: 'GOES-19 ABI | SMN' };

  return { url, options };
}
