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

export function docsRouteFor(base: string, pathname: string, hash: string): DocsRoute {
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;

  return {
    commands: ['/docs', ...relative.split('/').filter(Boolean)],
    fragment: hash ? decodeURIComponent(hash.replace(/^#/, '')) : undefined,
  };
}
