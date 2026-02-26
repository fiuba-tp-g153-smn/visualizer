/**
 * Application Configuration - Centralized Exports
 *
 * This file re-exports all application configuration for cleaner imports.
 */

// Backend configuration
export { buildConfigUrl, buildTileUrl } from './backend.config';

// Map configuration
export { MAP_CONFIG } from './map.config';

// Tile provider configuration
export { TILE_PROVIDERS, getTileProvider } from './tile-providers.config';

// Layer definitions and setup (re-export from layers folder)
export {
  LAYER_DEFINITIONS,
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  LAYER_RENDERING_CONFIG,
  DEFAULT_ACTIVE_LAYERS,
  filterDisabledLayers,
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from './layers';
