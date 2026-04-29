/**
 * Base map configuration
 *
 * Holds purely-client concerns related to base maps:
 *   - Preview tile coordinates for the selector thumbnails.
 *   - The DTO shape of the backend `/basemap/providers` response.
 *   - Attribution link-wrapping (backend returns plain text; Leaflet wants HTML).
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
