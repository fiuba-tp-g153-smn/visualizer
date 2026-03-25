/**
 * Application Configuration - Centralized Exports
 *
 * Este archivo re-exporta toda la configuración de la aplicación.
 * Incluye tanto valores basados en environment como valores configurables ajustables.
 *
 * Para constantes literales del código (event names, etc.), ver constants/
 */

// Data service backend configuration
export {
  buildConfigUrl,
  buildTileUrl,
  buildSatellitePointQueryUrl,
  buildRadarPointQueryUrl,
} from './backend.config';

// Alerts Service configuration (polygon operations and departments)
export {
  buildIntersectCountryUrl,
  buildIntersectDepartmentsUrl,
  buildGenerateAlertsUrl,
} from './alerts-service.config';

// Timing configuration (delays, tooltips, actions)
export { TOOLTIP_DELAYS, ACTION_DELAYS } from './timing.config';

// Map configuration (initial position, zoom levels, prerender)
export { MAP_CONFIG } from './map.config';

// Base map definitions and utilities
export { BASE_MAPS, getBaseMap, getAllBaseMaps } from './base-maps.config';

// Map polygons configuration (styles, z-index)
export {
  POLYGON_STYLE,
  LINE_GUIDE_STYLE,
  EDIT_STYLE,
  DEPARTMENT_STYLE,
  Z_INDEX,
} from './map-polygons.config';

// Layer definitions and setup (re-export from layers folder)
export {
  LAYER_DEFINITIONS,
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  DEFAULT_LAYER_CONTROLS,
  DEFAULT_ACTIVE_LAYERS,
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from './layers';
