import { environment } from '../../environments/environment';

/**
 * Configuración del backend basada en variables de entorno
 */
const BACKEND_BASE_URL = environment.backend.baseUrl;

const BACKEND_CONFIG = {
  baseUrl: BACKEND_BASE_URL,
  endpoints: {
    tiles: `${BACKEND_BASE_URL}/tiles`,
    products: `${BACKEND_BASE_URL}/products`,
  },
} as const;

/**
 * Construye URL de configuración de canal para un producto específico
 * @param pathToProduct - Ruta específica del producto (e.g., "goes-19/abi/ch-02")
 * @returns URL para obtener la configuración del canal
 */
export function buildChannelConfigUrl(pathToProduct: string): string {
  return `${BACKEND_CONFIG.endpoints.products}/${pathToProduct}`;
}

/**
 * Construye URL de tiles para un producto específico
 * @param pathToTileset - Ruta específica del tileset (e.g., "goes-19/abi/ch-02/202601010000")
 * @returns URL template para Leaflet con formato desde environment
 */
export function buildTileUrl(pathToProduct: string): string {
  const format = environment.tiles.format;
  return `${BACKEND_CONFIG.endpoints.tiles}/${pathToProduct}/{z}/{x}/{y}.${format}`;
}
