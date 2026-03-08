import { environment } from '../../environments/environment';

/**
 * Configuración del servicio de datos basada en variables de entorno
 */
const DATA_SERVICE_BASE_URL = environment.dataService.baseUrl;

/**
 * Construye URL de configuración de canal para un producto específico
 * @param pathToProduct - Ruta específica del producto (e.g., "goes-19/abi/ch-2")
 * @returns URL para obtener la configuración del canal
 */
export function buildConfigUrl(pathToProduct: string): string {
  return `${DATA_SERVICE_BASE_URL}/products/${pathToProduct}`;
}

/**
 * Construye URL de tiles para un producto específico
 * @param pathToTileset - Ruta específica del tileset (e.g., "goes-19/abi/ch-2/202601010000")
 * @returns URL template para Leaflet con formato desde environment
 */
export function buildTileUrl(pathToProduct: string): string {
  const format = environment.tiles.format;
  return `${DATA_SERVICE_BASE_URL}/products/${pathToProduct}/{z}/{x}/{y}.${format}`;
}
