/**
 * Application Configuration - Centralized Exports
 *
 * This file re-exports all application configuration for cleaner imports.
 */

// Backend configuration
export { buildConfigUrl, buildTileUrl } from './backend.config';

// Map configuration
export { MAP_CONFIG } from './map.config';

// Base map configuration
export { BASE_MAPS, getBaseMap, getAllBaseMaps } from './base-maps.config';

// Layer definitions and setup (re-export from layers folder)
export {
  LAYER_DEFINITIONS,
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  DEFAULT_LAYER_CONTROLS,
  DEFAULT_ACTIVE_LAYERS,
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from './layers';
