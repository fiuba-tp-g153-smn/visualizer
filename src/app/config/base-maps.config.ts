/**
 * Base map configuration
 *
 * Holds purely-client concerns related to base maps:
 *   - Preview tile coordinates for the selector thumbnails.
 *   - The DTO shape of the backend `/basemap/providers` response.
 *   - Attribution link-wrapping (backend returns plain text; Leaflet wants HTML).
 *   - Direct upstream tile sources used as primary, with data-service as fallback.
 *
 * The list of available providers itself lives on the backend and is fetched
 * at runtime by `BaseMapService` — never duplicate it here.
 */

/**
 * Preview tile coordinates configuration.
 * The backend `/basemap/{provider}/{z}/{x}/{y}.png` endpoint serves XYZ tiles
 * (Y=0 at top), so no TMS inversion is needed here.
 */
export const BASE_MAP_PREVIEW_CONFIG = {
  z: 2,
  x: 1,
  y: 2,
} as const;

/**
 * Raw entry shape returned by `GET /basemap/providers`.
 * Fields are snake_case on the wire; mapped to the `BaseMap` model on ingest.
 */
export interface BaseMapProviderDto {
  id: string;
  name: string;
  min_zoom: number;
  max_zoom: number;
  cache_max_zoom: number;
  attribution: string;
}

export interface BaseMapProvidersResponse {
  providers: ReadonlyArray<BaseMapProviderDto>;
}

/**
 * Direct upstream tile sources for each provider, used by Leaflet as the primary
 * tile layer. The data-service URL (`buildBasemapTileUrl`) is kept as fallback and
 * is used when a tile from the direct source fails (via Leaflet's `tileerror`).
 *
 * `isTms` mirrors the data-service `is_tms` flag: when true, Leaflet must flip Y
 * from XYZ to TMS convention before substituting the template — set `tms: true`
 * on the `L.tileLayer` options.
 *
 * `name`, `attribution`, `minZoom` and `maxNativeZoom` mirror the backend's
 * `PROVIDER_DEFAULTS` (services/basemap_config.py). They let `BaseMapService`
 * build the full picker list from this table alone — so base maps render
 * (direct-from-upstream) even when the data-service is unreachable. When
 * `/basemap/providers` does respond, its values refine these in place; drift
 * only triggers a metadata refresh, never a broken list.
 *
 * Providers absent from this map (e.g. WMS overlays) go through the data-service
 * only and have no direct tile source.
 */
export interface DirectTileSource {
  readonly urlTemplate: string;
  readonly isTms: boolean;
  /** Human-readable display name (mirrors backend `name`). */
  readonly name: string;
  /** Plain-text attribution (mirrors backend `attribution`; wrapped via `formatAttribution`). */
  readonly attribution: string;
  /** Lowest zoom the provider supports (mirrors backend `min_zoom`). */
  readonly minZoom: number;
  /** Fetch ceiling: highest zoom we request tiles for (mirrors backend `max_zoom`). */
  readonly maxNativeZoom: number;
}

export const BASEMAP_DIRECT_SOURCES: Readonly<Record<string, DirectTileSource>> = {
  argenmap: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
    name: 'Argenmap',
    attribution: 'Instituto Geográfico Nacional + OpenStreetMap contributors',
    minZoom: 3,
    maxNativeZoom: 21,
  },
  argenmapGris: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
    name: 'Argenmap gris',
    attribution: 'Instituto Geográfico Nacional',
    minZoom: 3,
    maxNativeZoom: 21,
  },
  argenmapOscuro: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
    name: 'Argenmap oscuro',
    attribution: 'Instituto Geográfico Nacional',
    minZoom: 3,
    maxNativeZoom: 21,
  },
  argenmapTopografico: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
    name: 'Argenmap topográfico',
    attribution: 'Instituto Geográfico Nacional',
    minZoom: 3,
    maxNativeZoom: 21,
  },
  satellite: {
    urlTemplate:
      'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    isTms: false,
    name: 'Imágenes satelitales Esri',
    attribution: 'Tiles © Esri',
    minZoom: 3,
    maxNativeZoom: 17,
  },
  topographic: {
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    isTms: false,
    name: 'Mapa topográfico Esri',
    attribution: 'Tiles © Esri',
    minZoom: 3,
    maxNativeZoom: 8,
  },
  googleSatellite: {
    urlTemplate: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    isTms: false,
    name: 'Imágenes satelitales Google',
    attribution: '© Google',
    minZoom: 3,
    maxNativeZoom: 20,
  },
  oceanBase: {
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    isTms: false,
    name: 'Mapa Esri Fondo Oceánico',
    attribution: 'Tiles © Esri',
    minZoom: 3,
    maxNativeZoom: 16,
  },
} as const;

/**
 * Substrings inside an attribution string that we know how to turn into links.
 * Backend returns plain text so we wrap known patterns here. Anything that
 * doesn't match falls through unchanged.
 */
const ATTRIBUTION_LINKS: ReadonlyArray<{ pattern: string; url: string }> = [
  {
    pattern: 'Instituto Geográfico Nacional',
    url: 'http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2',
  },
  {
    pattern: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/copyright',
  },
];

/**
 * Wraps known provider/source names inside a plain-text attribution with
 * anchor tags so Leaflet's attribution control renders them as links.
 */
export function formatAttribution(plainText: string): string {
  let html = plainText;
  for (const { pattern, url } of ATTRIBUTION_LINKS) {
    if (!html.includes(pattern)) continue;
    html = html.split(pattern).join(`<a href="${url}" target="_blank">${pattern}</a>`);
  }
  return html;
}
