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

/**
 * URL del health-check del data-service. Devuelve 200 cuando el servicio
 * está arriba; cualquier otra respuesta (o timeout/network error) indica
 * indisponibilidad.
 */
export function buildDataServiceHealthUrl(): string {
  return `${DATA_SERVICE_BASE_URL}/health`;
}

/**
 * URL del snapshot más reciente de estaciones meteorológicas SMN.
 */
export function buildWeatherStationsLatestUrl(): string {
  return `${DATA_SERVICE_BASE_URL}/weather-stations/latest`;
}

/**
 * URL del snapshot para un tilesetId específico (hora bucket) con
 * tolerancia de N horas hacia atrás. N=0 fuerza match exacto.
 */
export function buildWeatherStationsTilesetUrl(tilesetId: string, maxPastHours: number): string {
  return `${DATA_SERVICE_BASE_URL}/weather-stations/${tilesetId}?N=${maxPastHours}`;
}

/**
 * URL del listado de hour-buckets disponibles en la ventana de retención.
 */
export function buildWeatherStationsTilesetsUrl(): string {
  return `${DATA_SERVICE_BASE_URL}/weather-stations/tilesets`;
}

/**
 * URL del registro canónico de estaciones (metadatos: nombre, coords, provincia).
 */
export function buildWeatherStationsRegistryUrl(): string {
  return `${DATA_SERVICE_BASE_URL}/weather-stations/stations`;
}

/**
 * URL del histórico bundleado de una estación: todas las variables de las
 * últimas `hours` horas en un único JSON (el data-service pivotea los snapshots
 * por hora del lado del servidor, así el front hace una sola request).
 */
export function buildWeatherStationsSeriesUrl(stationId: number, hours = 48): string {
  return `${DATA_SERVICE_BASE_URL}/weather-stations/station/${stationId}/series?hours=${hours}`;
}
