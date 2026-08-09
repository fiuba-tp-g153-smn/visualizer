/**
 * Router target for the docs page currently shown in the iframe.
 *
 * The iframe's own URL carries the base the docs are served from
 * (`/docs-site/uso-general/`), while the shell's route does not
 * (`/docs/uso-general`), so the base has to come off before navigating.
 */
export interface DocsRoute {
  readonly commands: readonly string[];
  readonly fragment?: string;
}

/**
 * URL to point the iframe at for a docs page.
 *
 * The trailing slash is load-bearing: MkDocs builds directory URLs, so every
 * asset path inside a page is written relative to `<page>/`. Without it the
 * browser resolves them one level too high and the page renders unstyled.
 * Production only papers over this because nginx redirects the slash on.
 */
export function docsPageUrl(base: string, path: string, fragment: string | null): string {
  const page = path.replace(/^\/+|\/+$/g, '');
  const url = page ? `${base}/${page}/` : `${base}/`;

  return fragment ? `${url}#${fragment}` : url;
}

export function docsRouteFor(base: string, pathname: string, hash: string): DocsRoute {
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;

  return {
    commands: ['/docs', ...relative.split('/').filter(Boolean)],
    fragment: hash ? decodeURIComponent(hash.replace(/^#/, '')) : undefined,
  };
}
