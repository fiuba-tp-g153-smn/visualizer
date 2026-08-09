/**
 * Prime every docs page into the browser cache once the browser goes idle.
 *
 * Material's own `navigation.instant.prefetch` only fires on hover, which does
 * nothing for the first click of a session and nothing at all on touch. The
 * whole site is five pages of ~5-10 KB gzipped, so fetching all of them during
 * the first idle moment costs about 30 KB and makes every later click
 * zero-network.
 *
 * This only pays off because the pages are served with a positive `max-age`:
 * under `no-cache` a prefetched response still has to be revalidated before it
 * can be used, which is the round trip we are trying to remove.
 */
(function () {
  'use strict';

  // Survives instant navigations — the script runs once per window, not per page.
  var primed = {};
  // Bound so a future large nav tree can't turn one idle callback into a storm.
  var MAX_PAGES = 20;

  function prime(url) {
    if (primed[url]) return;
    primed[url] = true;
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }

  function candidates() {
    var here = location.origin + location.pathname;
    var urls = [];
    var anchors = document.querySelectorAll('.md-nav a[href], .md-footer a[href]');

    for (var i = 0; i < anchors.length && urls.length < MAX_PAGES; i++) {
      var href = anchors[i].href;
      if (href.indexOf(location.origin) !== 0) continue; // off-site
      var url = href.split('#')[0];
      if (url === here || primed[url]) continue;
      urls.push(url);
    }
    return urls;
  }

  function primeAll() {
    var urls = candidates();
    for (var i = 0; i < urls.length; i++) prime(urls[i]);
  }

  function whenIdle(fn) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout: 3000 });
    } else {
      window.setTimeout(fn, 1500);
    }
  }

  function schedule() {
    whenIdle(primeAll);
  }

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(schedule);
  } else {
    window.addEventListener('load', schedule);
  }
})();
