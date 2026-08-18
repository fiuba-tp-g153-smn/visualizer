/**
 * Click-to-zoom for the architecture diagrams.
 *
 * The docs are embedded in an iframe inside the Angular app, so a diagram at
 * natural size does not fit. Pages render it scaled to the column width; this
 * opens it over the page at full size on click, and closes on click or Escape.
 */
(function () {
  'use strict';

  var overlay = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function open(src, alt) {
    close();
    overlay = document.createElement('div');
    overlay.className = 'diagram-overlay';
    var img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    overlay.appendChild(img);
    overlay.addEventListener('click', close);
    document.body.appendChild(overlay);
  }

  function bindDiagrams() {
    // Instant navigation swaps the document; drop any overlay left open on the
    // page we just left.
    close();

    document.querySelectorAll('.md-typeset img.diagram').forEach(function (img) {
      img.addEventListener('click', function () {
        open(img.currentSrc || img.src, img.alt);
      });
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close();
  });

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(bindDiagrams);
  } else {
    document.addEventListener('DOMContentLoaded', bindDiagrams);
  }
})();
