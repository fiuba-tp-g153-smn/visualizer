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

/**
 * URL para consultar el valor puntual de una capa satelital en una coordenada.
 */
export function buildSatellitePointQueryUrl(
  productId: string,
  instrumentId: string,
  channelId: string,
  tilesetId: string,
  lat: number,
  lon: number,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/${productId}/${instrumentId}/${channelId}/${tilesetId}/point?lat=${lat}&lon=${lon}`;
}

/**
 * URL para consultar el valor puntual de la capa ECMWF Total Precipitation.
 */
export function buildEcmwfTpPointQueryUrl(
  forecastTs: string,
  periodTs: string,
  lat: number,
  lon: number,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/ecmwf/total-precipitation/${forecastTs}/${periodTs}/point?lat=${lat}&lon=${lon}`;
}

/**
 * URL del GeoJSON de isobaras de la capa ECMWF Mean Sea Level Pressure.
 * Renderizada como overlay vectorial sobre TP.
 */
export function buildEcmwfMslpGeojsonUrl(forecastTs: string, timestampTs: string): string {
  return `${DATA_SERVICE_BASE_URL}/products/ecmwf/mean-sea-level-pressure/${forecastTs}/${timestampTs}.json`;
}

/**
 * URL para consultar el valor puntual de la capa ECMWF Mean Sea Level Pressure.
 */
export function buildEcmwfMslpPointQueryUrl(
  forecastTs: string,
  timestampTs: string,
  lat: number,
  lon: number,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/ecmwf/mean-sea-level-pressure/${forecastTs}/${timestampTs}/point?lat=${lat}&lon=${lon}`;
}

/**
 * Construye la URL de un tile WRF para Leaflet (con placeholders {z}/{x}/{y}).
 */
export function buildWrfTileUrl(
  productId: string,
  initTag: string,
  fxxx: string,
): string {
  const format = environment.tiles.format;
  return `${DATA_SERVICE_BASE_URL}/products/wrf/${productId}/${initTag}/${fxxx}/{z}/{x}/{y}.${format}`;
}

/**
 * URL para consultar el valor puntual del COG WRF en una coordenada.
 */
export function buildWrfPointQueryUrl(
  productId: string,
  initTag: string,
  fxxx: string,
  lat: number,
  lon: number,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/wrf/${productId}/${initTag}/${fxxx}/point?lat=${lat}&lon=${lon}`;
}

/**
 * URL concreta de un tile GeoJSON de barbas WRF (z/x/y).
 */
export function buildWrfBarbTileUrl(
  productId: string,
  initTag: string,
  fxxx: string,
  z: number,
  x: number,
  y: number,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/wrf/${productId}/${initTag}/${fxxx}/barbs/${z}/${x}/${y}.json`;
}

/**
 * URL del GeoJSON de un overlay WRF (barbas / contornos / isobaras).
 */
export function buildWrfGeojsonUrl(
  productId: string,
  initTag: string,
  fxxx: string,
  layer: string,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/wrf/${productId}/${initTag}/${fxxx}/${layer}.json`;
}

/**
 * URL para consultar el valor puntual de una capa de radar en una coordenada.
 */
export function buildRadarPointQueryUrl(
  radarId: string,
  variableId: string,
  elevationId: string,
  tilesetId: string,
  lat: number,
  lon: number,
): string {
  return `${DATA_SERVICE_BASE_URL}/products/radar/${radarId}/${variableId}/${elevationId}/${tilesetId}/point?lat=${lat}&lon=${lon}`;
}

/**
 * Construye URL template de tiles de mapa base para un provider.
 * @param providerId - ID del provider devuelto por /basemap/providers
 * @returns URL template para Leaflet con {z}/{x}/{y}
 */
export function buildBasemapTileUrl(providerId: string): string {
  return `${DATA_SERVICE_BASE_URL}/basemap/${providerId}/{z}/{x}/{y}.png`;
}

/**
 * URL del listado de providers de mapa base habilitados en el backend.
 */
export function buildBasemapProvidersUrl(): string {
  return `${DATA_SERVICE_BASE_URL}/basemap/providers`;
}
