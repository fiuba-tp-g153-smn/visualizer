/**
 * Constantes de unidades y conversiones utilizadas en el visualizador
 */

/**
 * Unidades de temperatura
 */
export const TEMPERATURE_UNITS = {
  KELVIN: 'K',
  CELSIUS: '°C',
} as const;

/**
 * Unidades de velocidad del viento
 */
export const WIND_SPEED_UNITS = {
  KILOMETERS_PER_HOUR: 'km/h',
  KNOTS: 'kt',
} as const;

/**
 * Alias legacy de unidades de velocidad del viento
 */
export const WIND_SPEED_UNIT_ALIASES = {
  KNOTS_SPANISH: 'nudos',
} as const;

/**
 * Unidades de radar
 */
export const RADAR_UNITS = {
  REFLECTIVITY: 'dBZ', // Reflectividad (DBZH, ZH, TH)
  DIFFERENTIAL_REFLECTIVITY: 'dB', // Reflectividad diferencial (ZDR)
  VELOCITY: 'm/s', // Velocidad radial (VRAD)
  CORRELATION: 'ρhv', // Coeficiente de correlación (RHOHV)
  DIFFERENTIAL_PHASE: '°/km', // Fase diferencial específica (KDP)
} as const;

/**
 * Unidades de satélite GLM (Geostationary Lightning Mapper)
 */
export const GLM_UNITS = {
  FLASH_DENSITY: 'fl/km2', // Densidad de rayos (FED)
  ENERGY: 'fJ', // Energía total óptica (TOE)
  AREA: 'km2', // Área mínima de flash (MFA)
} as const;

/**
 * Unidades de satélite ABI (Advanced Baseline Imager)
 */
export const ABI_UNITS = {
  REFLECTANCE: '%', // Reflectancia (canales visibles)
} as const;

/**
 * Unidades de distancia
 */
export const DISTANCE_UNITS = {
  KILOMETERS: 'km',
  METERS: 'm',
} as const;

/**
 * Unidades de precipitación
 */
export const PRECIPITATION_UNITS = {
  MILLIMETERS: 'mm',
} as const;

/**
 * Unidades estándar de observación meteorológica
 */
export const WEATHER_STATION_UNITS = {
  HUMIDITY: '%',
  PRESSURE: 'hPa',
  VISIBILITY: DISTANCE_UNITS.KILOMETERS,
  WIND_SPEED: WIND_SPEED_UNITS.KILOMETERS_PER_HOUR,
} as const;

/**
 * Offset de conversión de Kelvin a Celsius
 */
export const KELVIN_TO_CELSIUS_OFFSET = 273.15;

/**
 * Factor de conversión de nudos a km/h
 */
export const KNOT_TO_KILOMETERS_PER_HOUR_FACTOR = 1.852;
