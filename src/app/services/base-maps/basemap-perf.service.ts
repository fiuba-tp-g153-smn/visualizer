import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Dev-only PerformanceObserver for `/basemap/...` tile requests.
 *
 * Tracks each tile's `responseEnd - startTime` and logs P50/P95 to the
 * console once per session (on `beforeunload`). Gives a quick view of
 * "what cache mode is effectively serving us today" without touching the
 * backend — useful when chasing complaints like "the map feels slow".
 *
 * Disabled in production builds.
 */
@Injectable({
  providedIn: 'root',
})
export class BasemapPerfService implements OnDestroy {
  private readonly samples: number[] = [];
  private observer: PerformanceObserver | null = null;
  private readonly unloadHandler = () => this.report();

  constructor() {
    if (environment.production) return;
    if (typeof PerformanceObserver === 'undefined') return;

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.name.includes('/basemap/')) continue;
        this.samples.push(entry.duration);
      }
    });

    try {
      this.observer.observe({ type: 'resource', buffered: true });
    } catch {
      this.observer.observe({ entryTypes: ['resource'] });
    }

    window.addEventListener('beforeunload', this.unloadHandler);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    window.removeEventListener('beforeunload', this.unloadHandler);
  }

  private report(): void {
    if (this.samples.length === 0) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    console.info(
      `[basemap-perf] ${sorted.length} tile reqs — P50 ${p(0.5).toFixed(0)}ms · P95 ${p(0.95).toFixed(0)}ms · max ${sorted[sorted.length - 1].toFixed(0)}ms`,
    );
  }
}
