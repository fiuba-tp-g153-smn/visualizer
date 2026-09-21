/**
 * Tile cache service worker.
 *
 * Why this exists: the timeline animator keeps only a few frames attached to
 * the map, so every other frame's Leaflet layer is torn down and rebuilt each
 * loop. Leaflet cancels in-flight requests when it removes a tile (it points
 * the <img> at an empty data URI), so a tile that had not finished loading
 * never reaches the browser HTTP cache and is genuinely re-downloaded on the
 * next pass. This worker gives tiles a cache that survives that churn, and
 * page reloads with it.
 *
 * Scope discipline — this worker is deliberately narrow:
 *   * Only GETs, only the data-service origin, only tile-shaped paths.
 *     Everything else returns without calling respondWith(), so the request is
 *     handled exactly as if no worker were installed. It cannot affect app
 *     shell delivery, API calls, or third-party basemap providers.
 *   * The data-service origin is passed in at registration time as the `api`
 *     query parameter, so this file needs no build-time templating and can
 *     never accidentally capture another host (notably wms.ign.gob.ar, whose
 *     TMS tiles share the /{z}/{x}/{y}.png shape but send no CORS header — a
 *     CORS re-fetch of those would fail).
 *
 * Only `immutable` responses are stored. data-service answers a missing tile
 * with a transparent placeholder under a short, non-immutable Cache-Control
 * and a distinct `-miss` ETag; caching those first-class would pin a gap
 * forever and the real tile would never appear once it lands.
 */

const CACHE_NAME = 'mapasmn-tiles-v1';

/** Entries kept before the oldest are evicted. ~4k tiles ≈ tens of MB. */
const MAX_ENTRIES = 4000;

/** Trim is O(cache size), so amortise it instead of running on every write. */
const TRIM_EVERY = 200;

/** `/products/<...>/{z}/{x}/{y}.webp` and `/basemap/<provider>/{z}/{x}/{y}.png`. */
const TILE_PATH = /^\/(products|basemap)\/.+\/\d+\/\d+\/\d+\.(webp|png)$/;

const API_ORIGIN = (() => {
  const declared = new URL(self.location.href).searchParams.get('api');
  try {
    return new URL(declared || self.location.origin).origin;
  } catch {
    return self.location.origin;
  }
})();

let writesSinceTrim = 0;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== API_ORIGIN || !TILE_PATH.test(url.pathname)) return;

  event.respondWith(serveTile(request, url.href));
});

/**
 * Cache-first for tiles, falling back to the network.
 *
 * The triggering request comes from an <img> with no crossOrigin attribute, so
 * it is a no-cors request whose response is opaque and not usefully storable.
 * We issue our own CORS fetch instead — data-service answers every tile with
 * `Access-Control-Allow-Origin: *` — which yields an inspectable response we
 * can both cache and hand back. Doing it here rather than setting
 * `crossOrigin` on the Leaflet layers avoids changing the browser's cache key
 * for every tile, which would have forced one full re-download for every user.
 */
async function serveTile(request, href) {
  const cache = await caches.open(CACHE_NAME);

  const hit = await cache.match(href);
  if (hit) return hit;

  let response;
  try {
    response = await fetch(href, { mode: 'cors', credentials: 'omit' });
  } catch {
    // CORS rejected, offline, or DNS failure — behave as if we were not here.
    return fetch(request);
  }

  if (response.ok && isImmutable(response)) {
    void store(cache, href, response.clone());
  }
  return response;
}

/** True when the server marked this payload as safe to keep indefinitely. */
function isImmutable(response) {
  return (response.headers.get('cache-control') || '').includes('immutable');
}

async function store(cache, href, response) {
  try {
    await cache.put(href, response);
  } catch {
    return; // quota exceeded or storage disabled — caching is best-effort
  }
  if (++writesSinceTrim < TRIM_EVERY) return;
  writesSinceTrim = 0;
  await trim(cache);
}

/** Evict oldest-first; Cache.keys() preserves insertion order. */
async function trim(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}
