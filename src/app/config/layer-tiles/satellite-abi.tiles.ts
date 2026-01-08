import { buildTileUrl, BACKEND_CONFIG } from '../backend.config';
import { SATELLITE_TILE_OPTIONS } from './tile-config.types';
import * as L from 'leaflet';

/**
 * Configuración de tiles para canales ABI
 */

/**
 * URLs mock usando CartoDB con diferentes estilos para testing
 */
const MOCK_URLS: Record<string, string> = {
  'abi-ch2': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  'abi-ch9': 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  'abi-ch13': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

/**
 * Crea un tile layer para un canal ABI
 * @param layerId ID del canal (ej: 'abi-ch2')
 * @param opacity Opacidad 0-100
 */
export function createAbiTileLayer(layerId: string, opacity: number): L.TileLayer {
  const urlTemplate = BACKEND_CONFIG.useMockTiles ? MOCK_URLS[layerId] : buildTileUrl(layerId);

  const options = BACKEND_CONFIG.useMockTiles
    ? { attribution: `Mock: Canal ABI ${layerId}` }
    : { ...SATELLITE_TILE_OPTIONS, attribution: 'GOES-16 ABI | SMN' };

  return L.tileLayer(urlTemplate, {
    ...options,
    opacity: opacity / 100,
  });
}
