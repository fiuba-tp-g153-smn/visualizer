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
  buildEcmwfTpPointQueryUrl,
  buildEcmwfMslpGeojsonUrl,
  buildEcmwfMslpPointQueryUrl,
  buildBasemapTileUrl,
  buildBasemapProvidersUrl,
  buildDataServiceHealthUrl,
} from './backend.config';

// Alerts Service configuration (polygon operations and departments)
export {
  buildIntersectCountryUrl,
  buildIntersectDepartmentsUrl,
  buildGenerateAlertsUrl,
  buildPhenomenaUrl,
  buildAlertsUrl,
} from './alerts-service.config';

// Timing configuration (delays, tooltips, actions)
export { TOOLTIP_DELAYS, ACTION_DELAYS } from './timing.config';

// Map configuration (initial position, zoom levels, prerender)
export { MAP_CONFIG, MAP_Z_INDEX } from './map.config';

// Base map client-side configuration (preview coords, DTOs, attribution helper, direct sources)
export {
  BASEMAP_DIRECT_SOURCES,
  BASE_MAP_PREVIEW_CONFIG,
  formatAttribution,
  type DirectTileSource,
  type BaseMapProviderDto,
  type BaseMapProvidersResponse,
} from './base-maps.config';

// Map polygons configuration (styles, z-index)
export {
  POLYGON_STYLE,
  LINE_GUIDE_STYLE,
  EDIT_STYLE,
  DEPARTMENT_STYLE,
  Z_INDEX,
} from './map-polygons.config';

// INDEC province codes (department code -> province name mapping)
export { INDEC_PROVINCE_CODES, getProvinceNameFromDepartmentCode } from './indec-provinces.config';

// Layer definitions and setup (re-export from layers folder)
export {
  LAYER_DEFINITIONS,
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  DEFAULT_LAYER_CONTROLS,
  DEFAULT_ACTIVE_LAYERS,
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from './layers';

// SEO / social-sharing metadata (per-route titles, descriptions, OG/Twitter)
export {
  SITE_URL,
  SITE_NAME,
  OG_IMAGE,
  DEFAULT_SEO,
  STATUS_SEO,
  DOCS_SEO,
  type RouteSeo,
} from './seo.config';
