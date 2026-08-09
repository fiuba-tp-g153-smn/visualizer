/**
 * Keeps the Angular shell's URL in sync while the docs run inside its iframe.
 * Replaces docs-service/src/clientModules/notifyParent.ts (Docusaurus).
 *
 * `document$` is Material's per-page observable — it emits on first load and
 * again after every instant-navigation swap, which is exactly where Docusaurus
 * used onRouteDidUpdate.
 */
(function () {
  'use strict';

  if (window.parent === window) return; // not embedded — nothing to sync

  var isInitialLoad = true;

  function notifyParent() {
    if (isInitialLoad) {
      // The parent set this URL itself; echoing it back would overwrite the
      // fragment it is still waiting to scroll to.
      isInitialLoad = false;
      return;
    }
    window.parent.postMessage(
      {
        type: 'docs-navigation',
        path: location.pathname,
        hash: location.hash ? decodeURIComponent(location.hash) : '',
      },
      window.location.origin,
    );
  }

  function scrollToAnchor(anchor) {
    var element = document.getElementById(anchor);
    if (element) element.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (data && data.type === 'scroll-to-anchor' && data.anchor) scrollToAnchor(data.anchor);
  });

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(notifyParent);
  } else {
    window.addEventListener('load', notifyParent);
  }
})();
