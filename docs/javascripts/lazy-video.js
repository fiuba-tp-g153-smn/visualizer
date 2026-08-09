/**
 * Plays the demo videos once they scroll into view, and pauses them when they
 * leave.
 *
 * The videos carry `preload="none"`, so the browser fetches nothing until
 * something calls play() — that is what keeps a page from pulling megabytes the
 * reader may never scroll to. The `autoplay` attribute cannot do this: it
 * overrides the preload hint and downloads offscreen videos in full.
 *
 * The videos have no controls, so this script is the only thing that starts
 * them: without it a reader sees the poster frame and nothing else.
 */
(function () {
  'use strict';

  var observer = null;

  function watchVideos() {
    // Instant navigation swaps the document, leaving the previous page's
    // elements observed.
    if (observer) observer.disconnect();

    var videos = document.querySelectorAll('video');
    if (!videos.length || !('IntersectionObserver' in window)) return;

    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          if (entry.isIntersecting) {
            // Rejects when the browser declines to autoplay; the poster stays.
            var started = video.play();
            if (started && started.catch) started.catch(function () {});
          } else if (!video.paused) {
            video.pause();
          }
        });
      },
      { threshold: 0.25 },
    );

    videos.forEach(function (video) {
      observer.observe(video);
    });
  }

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(watchVideos);
  } else {
    document.addEventListener('DOMContentLoaded', watchVideos);
  }
})();
