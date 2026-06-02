/**
 * Application Constants - Centralized Exports
 *
 * Este archivo re-exporta constantes literales necesarias para el código.
 * Son valores que si cambian, el código deja de funcionar (event names, property names, etc.)
 *
 * Para valores configurables (delays, estilos, z-index), ver config/
 */

// Constantes literales de polígonos (nombres de eventos, propiedades CSS, panes)
export { MAP_PANES, CSS_VARIABLES, LEAFLET_EDITABLE_EVENTS } from './map-polygons.constants';

// Códigos de fenómenos meteorológicos para alertas
export { PHENOMENON_CODES, type PhenomenonCode } from './phenomenon-codes.constants';

// Constantes de unidades y conversiones
export {
  TEMPERATURE_UNITS,
  WIND_SPEED_UNITS,
  WIND_SPEED_UNIT_ALIASES,
  RADAR_UNITS,
  GLM_UNITS,
  ABI_UNITS,
  DISTANCE_UNITS,
  PRECIPITATION_UNITS,
  WEATHER_STATION_UNITS,
  WRF_UNITS,
  KELVIN_TO_CELSIUS_OFFSET,
  KNOT_TO_KILOMETERS_PER_HOUR_FACTOR,
} from './units.constants';

export { STORAGE_KEYS } from './storage-keys.constants';
