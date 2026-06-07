import { Routes, UrlSegment } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { DocsComponent } from './pages/docs/docs.component';

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
  { path: '', component: HomeComponent },
  { matcher: docsPathMatcher, component: DocsComponent },
  {
    path: 'status',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'data-status',
    loadComponent: () =>
      import('./pages/data-dashboard/data-dashboard.component').then(
        (m) => m.DataDashboardComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
