import { environment } from '../../../environments/environment';

/** Served from `public/`, so it sits at the origin root and its scope is `/`. */
const TILE_SW_PATH = '/tile-sw.js';

/**
 * Register the tile cache service worker.
 *
 * The data-service origin is handed over as a query parameter rather than
 * baked into the worker, so `public/tile-sw.js` stays a plain static asset
 * with no build-time templating. It also keeps the worker from ever capturing
 * a third-party tile host by accident.
 *
 * Failure is non-fatal by design: the worker is a cache, and the app is fully
 * functional without it (unsupported browser, insecure origin, or a user who
 * has blocked site data all land here).
 */
export function registerTileCacheServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const url = `${TILE_SW_PATH}?api=${encodeURIComponent(environment.dataService.baseUrl)}`;

  // Wait for load so registration never competes with the first paint or the
  // initial burst of tile requests for bandwidth.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch((err) => {
      console.warn('Tile cache service worker registration failed:', err);
    });
  });
}
