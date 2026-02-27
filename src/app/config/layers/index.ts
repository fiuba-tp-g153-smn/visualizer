/**
 * Layer Configuration - Centralized Exports
 *
 * This file re-exports all layer-related configuration for cleaner imports.
 */

// Layer definitions and groups
export { LAYER_DEFINITIONS, ACTIVE_LAYER_GROUP_DEFINITIONS } from './layer-definitions';

// Layer setup (defaults and filtering)
export { DEFAULT_ACTIVE_LAYERS, filterDisabledLayers } from './layers-setup.config';

// Layer rendering configuration
export { LAYER_RENDERING_CONFIG } from './layer-render.config';

// IGN WMS configuration
export { IGN_WMS_BASE_CONFIG, IGN_WMS_WORKSPACE_URLS } from './ign-wms/config';

// Radar configuration
export { RADAR_SUBGROUPS } from './radar/config';

// GOES satellite configuration
export { ABI_SUBGROUP } from './goes/abi.config';
export { GLM_SUBGROUP } from './goes/glm.config';
