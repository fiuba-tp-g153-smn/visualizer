import { DestroyRef, Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { DEFAULT_SEO, SITE_NAME, SITE_URL, type RouteSeo } from '../../config';

/**
 * Keeps the document title, meta description, Open Graph / Twitter tags and the
 * canonical link in sync with the active route.
 *
 * The route-level metadata lives in each route's `data` (see `app.routes.ts`),
 * typed as {@link RouteSeo}. On every `NavigationEnd` the deepest activated
 * route's data is read and applied, falling back to {@link DEFAULT_SEO}.
 *
 * Non-JS social crawlers only read the static tags in `index.html`; these
 * runtime updates serve users (browser tab) and search engines that render
 * JavaScript (e.g. Google).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Starts listening for navigations. Call once at app boot. */
  init(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => this.resolveSeo(event.urlAfterRedirects)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ seo, canonical }) => this.apply(seo, canonical));
  }

  /** Reads the deepest activated route's `data` and the canonical URL for it. */
  private resolveSeo(urlAfterRedirects: string): { seo: RouteSeo; canonical: string } {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const seo = (route.data as Partial<RouteSeo>) ?? {};
    // Strip query string and fragment so the canonical URL stays clean.
    const path = urlAfterRedirects.split(/[?#]/)[0];
    return {
      seo: {
        title: seo.title ?? DEFAULT_SEO.title,
        description: seo.description ?? DEFAULT_SEO.description,
      },
      canonical: `${SITE_URL}${path}`,
    };
  }

  private apply(seo: RouteSeo, canonical: string): void {
    this.title.setTitle(seo.title);

    this.meta.updateTag({ name: 'description', content: seo.description });

    this.meta.updateTag({ property: 'og:title', content: seo.title });
    this.meta.updateTag({ property: 'og:description', content: seo.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });

    this.meta.updateTag({ name: 'twitter:title', content: seo.title });
    this.meta.updateTag({ name: 'twitter:description', content: seo.description });

    this.updateCanonical(canonical);
  }

  /** Updates (or creates) the `<link rel="canonical">` — Meta handles `<meta>` only. */
  private updateCanonical(href: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
