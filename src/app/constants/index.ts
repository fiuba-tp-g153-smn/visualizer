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
  RADAR_UNITS,
  GLM_UNITS,
  ABI_UNITS,
  DISTANCE_UNITS,
  KELVIN_TO_CELSIUS_OFFSET,
} from './units.constants';
