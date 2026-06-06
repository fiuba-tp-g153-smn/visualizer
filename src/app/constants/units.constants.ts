export const TEMPERATURE_UNITS = {
  KELVIN: 'K',
  CELSIUS: '°C',
} as const;

export const WIND_SPEED_UNITS = {
  KILOMETERS_PER_HOUR: 'km/h',
  KNOTS: 'kt',
} as const;

export const WIND_SPEED_UNIT_ALIASES = {
  KNOTS_SPANISH: 'nudos',
} as const;

export const RADAR_UNITS = {
  REFLECTIVITY: 'dBZ', // Reflectividad (DBZH, ZH, TH)
  DIFFERENTIAL_REFLECTIVITY: 'dB', // Reflectividad diferencial (ZDR)
  VELOCITY: 'm/s', // Velocidad radial (VRAD)
  CORRELATION: 'ρhv', // Coeficiente de correlación (RHOHV)
  DIFFERENTIAL_PHASE: '°/km', // Fase diferencial específica (KDP)
} as const;

export const GLM_UNITS = {
  FLASH_DENSITY: 'fl/km2', // Densidad de rayos (FED)
  ENERGY: 'fJ', // Energía total óptica (TOE)
  AREA: 'km2', // Área mínima de flash (MFA)
} as const;

export const ABI_UNITS = {
  REFLECTANCE: '%', // Reflectancia (canales visibles)
} as const;

export const DISTANCE_UNITS = {
  KILOMETERS: 'km',
  METERS: 'm',
} as const;

export const PRECIPITATION_UNITS = {
  MILLIMETERS: 'mm',
} as const;

export const WEATHER_STATION_UNITS = {
  HUMIDITY: '%',
  PRESSURE: 'hPa',
  VISIBILITY: DISTANCE_UNITS.KILOMETERS,
  WIND_SPEED: WIND_SPEED_UNITS.KILOMETERS_PER_HOUR,
} as const;

export const WRF_UNITS = {
  REFLECTIVITY: RADAR_UNITS.REFLECTIVITY,
  WIND_SPEED: WIND_SPEED_UNITS.KNOTS,
  SPECIFIC_HUMIDITY: 'g/kg',
  PRECIPITATION: PRECIPITATION_UNITS.MILLIMETERS,
  MUCAPE: 'J/kg',
  SEA_LEVEL_PRESSURE: WEATHER_STATION_UNITS.PRESSURE,
  DIMENSIONLESS: '',
} as const;

export const KELVIN_TO_CELSIUS_OFFSET = 273.15;
export const KNOT_TO_KILOMETERS_PER_HOUR_FACTOR = 1.852;
