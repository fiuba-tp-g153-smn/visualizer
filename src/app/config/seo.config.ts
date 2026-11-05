import { COMMON_TEXTS } from '../texts';
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

export const SITE_NAME = COMMON_TEXTS.seo.siteName;

/** Shared social preview image (reused SMN logo, 960×851). */
export const OG_IMAGE = `${SITE_URL}/SMN_Logo_Alta.png`;

export interface RouteSeo {
  /** Full document `<title>`. */
  readonly title: string;
  /** Meta description — aim for ≤160 characters. */
  readonly description: string;
}

export const DEFAULT_SEO: RouteSeo = COMMON_TEXTS.seo.default;

export const STATUS_SEO: RouteSeo = COMMON_TEXTS.seo.status;

export const DOCS_SEO: RouteSeo = COMMON_TEXTS.seo.docs;
