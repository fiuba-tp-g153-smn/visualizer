/**
 * A progress bar for instant navigation.
 *
 * Material 9.7 has no `navigation.instant.progress` feature, so a page swap that
 * has to touch the network shows nothing at all — the reader clicks and the old
 * page just sits there. This paints a bar the moment a link is clicked and
 * clears it when the replacement page renders (`document$`).
 *
 * When the target is already cached the bar is on screen for a frame or two,
 * which is the point: feedback appears only when there is a wait.
 */
(function () {
  'use strict';

  var BAR_ID = 'docs-nav-progress';
  // Never leave the bar stranded if a navigation is abandoned or fails.
  var STUCK_TIMEOUT_MS = 8000;
  var stuckTimer = null;

  function bar() {
    var el = document.getElementById(BAR_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BAR_ID;
      document.body.appendChild(el);
    }
    return el;
  }

  function show() {
    bar().classList.add('is-loading');
    window.clearTimeout(stuckTimer);
    stuckTimer = window.setTimeout(hide, STUCK_TIMEOUT_MS);
  }

  function hide() {
    window.clearTimeout(stuckTimer);
    var el = document.getElementById(BAR_ID);
    if (el) el.classList.remove('is-loading');
  }

  function isPlainLeftClick(event) {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.defaultPrevented
    );
  }

  document.addEventListener(
    'click',
    function (event) {
      if (!isPlainLeftClick(event)) return;

      var anchor = event.target && event.target.closest && event.target.closest('a[href]');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.href.indexOf(location.origin) !== 0) return;
      // Same page, different heading: no navigation, so no progress.
      if (anchor.href.split('#')[0] === location.origin + location.pathname) return;

      show();
    },
    true,
  );

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(hide);
  } else {
    window.addEventListener('load', hide);
  }
})();
