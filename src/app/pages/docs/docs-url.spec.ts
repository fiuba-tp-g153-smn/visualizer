import { describe, it, expect } from 'vitest';

import { docsRouteFor } from './docs-url';

const BASE = '/docs-site';

describe('docsRouteFor', () => {
  it('maps the docs index to the bare /docs route', () => {
    expect(docsRouteFor(BASE, '/docs-site/', '')).toEqual({
      commands: ['/docs'],
      fragment: undefined,
    });
  });

  it('strips the base path so the shell URL is /docs/<page>, not /docs/docs-site/<page>', () => {
    expect(docsRouteFor(BASE, '/docs-site/uso-general/', '').commands).toEqual([
      '/docs',
      'uso-general',
    ]);
  });

  it('splits nested pages into separate segments', () => {
    expect(docsRouteFor(BASE, '/docs-site/guia/avanzada/', '').commands).toEqual([
      '/docs',
      'guia',
      'avanzada',
    ]);
  });

  it('decodes percent-encoded accents so unicode anchors survive the round trip', () => {
    expect(docsRouteFor(BASE, '/docs-site/arquitectura/', '#introducci%C3%B3n')).toEqual({
      commands: ['/docs', 'arquitectura'],
      fragment: 'introducción',
    });
  });

  it('leaves the path alone when the docs are served from another base', () => {
    expect(docsRouteFor(BASE, '/uso-general/', '').commands).toEqual(['/docs', 'uso-general']);
  });
});
