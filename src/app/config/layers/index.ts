/**
 * Layer Configuration - Centralized Exports
 *
 * This file re-exports all layer-related configuration for cleaner imports.
 */

// Layer definitions and groups
export { LAYER_DEFINITIONS, ACTIVE_LAYER_GROUP_DEFINITIONS } from './layer-definitions';

// Layer setup (defaults and filtering)
export { DEFAULT_ACTIVE_LAYERS } from './layers-setup.config';

// Default layer control values
export { DEFAULT_LAYER_CONTROLS } from './layer-controls.config';

// IGN WMS configuration
export {
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
  IGN_WMS_BACKED_UP_LAYER_IDS,
} from './ign-wms/config';

// Radar configuration
export { RADAR_SUBGROUPS } from './radar/config';

// GOES satellite configuration
export { ABI_SUBGROUP } from './goes/abi/config';
export { GLM_SUBGROUP } from './goes/glm/config';

// ECMWF configuration
export { ECMWF_SUBGROUP } from './ecmwf/config';
