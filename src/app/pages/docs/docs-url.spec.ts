import { describe, it, expect } from 'vitest';

import { docsPageUrl, docsShellUrl } from './docs-url';

const BASE = '/docs-site';

describe('docsPageUrl', () => {
  it('ends a page URL with a slash so relative assets resolve inside the page directory', () => {
    expect(docsPageUrl(BASE, 'productos-meteorologicos', null)).toBe(
      '/docs-site/productos-meteorologicos/',
    );
  });

  it('points at the docs root when there is no page', () => {
    expect(docsPageUrl(BASE, '', null)).toBe('/docs-site/');
  });

  it('keeps a single slash when the path already carries one', () => {
    expect(docsPageUrl(BASE, '/uso-general/', null)).toBe('/docs-site/uso-general/');
  });

  it('appends the fragment after the trailing slash', () => {
    expect(docsPageUrl(BASE, 'arquitectura', 'introducción')).toBe(
      '/docs-site/arquitectura/#introducción',
    );
  });
});

describe('docsShellUrl', () => {
  it('maps the docs index to the bare /docs route', () => {
    expect(docsShellUrl(BASE, '/docs-site/', '')).toBe('/docs');
  });

  it('strips the base so the shell URL is /docs/<page>, not /docs/docs-site/<page>', () => {
    expect(docsShellUrl(BASE, '/docs-site/uso-general/', '')).toBe('/docs/uso-general');
  });

  it('keeps nested pages nested', () => {
    expect(docsShellUrl(BASE, '/docs-site/guia/avanzada/', '')).toBe('/docs/guia/avanzada');
  });

  it('passes the fragment through exactly as the frame reported it', () => {
    expect(docsShellUrl(BASE, '/docs-site/arquitectura/', '#introducci%C3%B3n')).toBe(
      '/docs/arquitectura#introducci%C3%B3n',
    );
  });

  it('leaves the path alone when the docs are served from another base', () => {
    expect(docsShellUrl(BASE, '/uso-general/', '')).toBe('/docs/uso-general');
  });
});
