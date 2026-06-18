import { Routes, UrlSegment } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { DocsComponent } from './pages/docs/docs.component';
import { DEFAULT_SEO, DOCS_SEO, STATUS_SEO } from './config';

/**
 * Custom URL matcher for docs routes.
 * Matches /docs and /docs/* capturing the full remaining path.
 */
function docsPathMatcher(segments: UrlSegment[]) {
  if (segments.length === 0 || segments[0].path !== 'docs') {
    return null;
  }

  const path = segments.slice(1).map((s) => s.path).join('/');

  return {
    consumed: segments,
    posParams: {
      path: new UrlSegment(path, {}),
    },
  };
}

export const routes: Routes = [
  { path: '', component: HomeComponent, data: DEFAULT_SEO },
  { matcher: docsPathMatcher, component: DocsComponent, data: DOCS_SEO },
  {
    path: 'status',
    loadComponent: () =>
      import('./pages/status/status.component').then((m) => m.StatusComponent),
    children: [
      { path: '', redirectTo: 'processing', pathMatch: 'full' },
      {
        path: 'processing',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: STATUS_SEO,
      },
      {
        path: 'cache',
        loadComponent: () =>
          import('./pages/data-dashboard/data-dashboard.component').then(
            (m) => m.DataDashboardComponent,
          ),
        data: STATUS_SEO,
      },
      {
        path: 'basemap',
        loadComponent: () =>
          import('./pages/basemap-dashboard/basemap-dashboard.component').then(
            (m) => m.BasemapDashboardComponent,
          ),
        data: STATUS_SEO,
      },
      {
        path: 'alerts',
        loadComponent: () =>
          import('./pages/alerts-dashboard/alerts-dashboard.component').then(
            (m) => m.AlertsDashboardComponent,
          ),
        data: STATUS_SEO,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
