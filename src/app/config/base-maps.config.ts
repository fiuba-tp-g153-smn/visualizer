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
 * Providers absent from this map (e.g. WMS overlays) go through the data-service
 * only and have no direct tile source.
 */
export interface DirectTileSource {
  readonly urlTemplate: string;
  readonly isTms: boolean;
}

export const BASEMAP_DIRECT_SOURCES: Readonly<Record<string, DirectTileSource>> = {
  argenmap: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
  },
  argenmapGris: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
  },
  argenmapOscuro: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_oscuro@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
  },
  argenmapTopografico: {
    urlTemplate:
      'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{y}.png',
    isTms: true,
  },
  satellite: {
    urlTemplate:
      'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    isTms: false,
  },
  topographic: {
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    isTms: false,
  },
  googleSatellite: {
    urlTemplate: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    isTms: false,
  },
  oceanBase: {
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    isTms: false,
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
