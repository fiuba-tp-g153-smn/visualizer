import { environment } from '../../environments/environment';

/**
 * Configuración del backend basada en variables de entorno
 */
const BACKEND_BASE_URL = environment.backend.baseUrl;

export const BACKEND_CONFIG = {
  baseUrl: BACKEND_BASE_URL,
  useMockTiles: environment.backend.useMockTiles,
  endpoints: {
    tiles: `${BACKEND_BASE_URL}/tiles`,
    products: `${BACKEND_BASE_URL}/products`,
  },
} as const;

/**
 * Construye URL de tiles para un producto específico
 * @param productName Nombre del producto (ej: 'abi-ch13')
 * @returns URL template para Leaflet con formato desde environment
 */
export function buildTileUrl(productName: string): string {
  const format = environment.tiles.format;
  return `${BACKEND_CONFIG.endpoints.tiles}/${productName}/{z}/{x}/{y}.${format}`;
}
