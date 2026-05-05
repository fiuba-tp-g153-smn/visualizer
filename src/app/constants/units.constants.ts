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
 * Offset de conversión de Kelvin a Celsius
 */
export const KELVIN_TO_CELSIUS_OFFSET = 273.15;
