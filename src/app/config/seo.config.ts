/**
 * SEO / social-sharing metadata.
 *
 * `DEFAULT_SEO` mirrors the static tags hardcoded in `src/index.html` — keep the
 * two in sync. The per-route entries are applied at runtime by `SeoService`,
 * which updates the document `<title>`, `<meta name="description">`, Open Graph
 * and Twitter tags, and the canonical link on each navigation. Non-JS social
 * crawlers only see the static `index.html` tags; these runtime updates serve
 * users (browser tab) and Google (which renders JavaScript).
 */

/** Public production origin — also used for absolute og:url / canonical / image URLs. */
export const SITE_URL = 'https://mapasmn.com';

export const SITE_NAME = 'Visualizador SMN';

/** Shared social preview image (reused SMN logo, 960×851). */
export const OG_IMAGE = `${SITE_URL}/SMN_Logo_Alta.png`;

export interface RouteSeo {
  /** Full document `<title>`. */
  readonly title: string;
  /** Meta description — aim for ≤160 characters. */
  readonly description: string;
}

export const DEFAULT_SEO: RouteSeo = {
  title: 'Visualizador SMN — Mapa meteorológico interactivo',
  description:
    'Visualizador interactivo del Servicio Meteorológico Nacional: imágenes satelitales GOES-19, radar meteorológico, modelos de pronóstico y estaciones en Argentina.',
};

export const STATUS_SEO: RouteSeo = {
  title: 'Estado del sistema — Visualizador SMN',
  description:
    'Estado operativo del Visualizador SMN: salud del procesamiento de datos, caché de mapas base y disponibilidad de los proveedores de mapas.',
};

export const DOCS_SEO: RouteSeo = {
  title: 'Documentación — Visualizador SMN',
  description:
    'Documentación del Visualizador SMN: guías de uso, capas disponibles y referencia técnica de la plataforma meteorológica del SMN.',
};
