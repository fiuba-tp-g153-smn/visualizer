import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const DEFAULT_FETCH_CONCURRENCY = 4;

/**
 * Warms the **browser HTTP cache** for weather-station snapshot URLs
 * (`/weather-stations/{tilesetId}?grace_period_hours=`), so timeline playback replays those
 * frames straight from the browser cache — no network and no JS-heap retention.
 *
 * This is the JSON analogue of {@link TilePrefetchService} (which warms the
 * browser *image* cache via `new Image()`): we issue the GETs ahead of time and
 * **discard** the parsed bodies. The cache lives in the browser (off-heap,
 * browser-evicted, gated by the backend's `Cache-Control`), not in this service —
 * so the app never holds all the weather-station frames in memory at once.
 *
 * The only retained state is a small in-flight `Set<string>` of URLs, used to
 * collapse concurrent duplicate warms; it is emptied as requests settle.
 */
@Injectable({
  providedIn: 'root',
})
export class WeatherStationsPrefetchService {
  private readonly http = inject(HttpClient);

  private readonly inFlight = new Set<string>();
  private readonly queue: string[] = [];
  private readonly maxConcurrency = DEFAULT_FETCH_CONCURRENCY;
  private activeFetches = 0;

  /**
   * Warm a set of URLs into the browser HTTP cache without blocking. URLs already
   * in flight are skipped; bodies and errors are discarded. A repeat warm of an
   * already-cached URL is a cheap browser-cache hit.
   */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) {
      if (this.inFlight.has(url)) {
        continue;
      }
      this.inFlight.add(url);
      this.queue.push(url);
    }
    this.drain();
  }

  private drain(): void {
    while (this.activeFetches < this.maxConcurrency && this.queue.length > 0) {
      const url = this.queue.shift();
      if (url === undefined) {
        break;
      }
      this.activeFetches += 1;
      // Fire the GET so the browser caches the response, then drop the body.
      void firstValueFrom(this.http.get(url, { responseType: 'text' }))
        .catch(() => undefined)
        .finally(() => {
          this.inFlight.delete(url);
          this.activeFetches -= 1;
          this.drain();
        });
    }
  }
}
