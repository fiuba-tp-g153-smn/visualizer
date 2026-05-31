import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { BackendSnapshot } from './weather-stations-backend.types';

const DEFAULT_MAX_CACHE_ENTRIES = 48;
const DEFAULT_FETCH_CONCURRENCY = 4;

/**
 * URL-keyed cache + fetch + prefetch for SMN weather-station snapshots
 * (`/weather-stations/{tilesetId}?N=`). Mirrors {@link VectorOverlayService}:
 * the response for a given `(tilesetId, N)` is immutable history, so caching it
 * by its URL lets the timeline animation replay frames with zero network — and
 * `prefetch()` warms the whole window up front so the first loop is instant.
 *
 * - LRU cache bounded to {@link DEFAULT_MAX_CACHE_ENTRIES} (covers the latest-24
 *   window with headroom for a Max-Past-Hours change).
 * - In-flight dedup: concurrent `load()`s for the same URL share one request.
 * - Bounded concurrency: at most {@link DEFAULT_FETCH_CONCURRENCY} parallel fetches.
 * - Fetch errors resolve to `null` (silent — the animation keeps going).
 */
@Injectable({
  providedIn: 'root',
})
export class SmnStationsSnapshotCacheService {
  private readonly http = inject(HttpClient);

  /** LRU: insertion order = use order. */
  private readonly cache = new Map<string, BackendSnapshot>();
  private readonly inflight = new Map<string, Promise<BackendSnapshot | null>>();

  private readonly maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES;
  private readonly maxConcurrency = DEFAULT_FETCH_CONCURRENCY;
  private activeFetches = 0;
  private readonly waiters: Array<() => void> = [];

  private readonly loadTickSignal = signal(0);
  /** Increments whenever a fetch populates the cache (lets effects re-sync). */
  readonly loadTick = this.loadTickSignal.asReadonly();

  /**
   * Returns the cached snapshot or fetches it. Resolves to `null` if the fetch
   * fails (network, 404, cancelled 401) so callers can fail soft.
   */
  async load(url: string): Promise<BackendSnapshot | null> {
    const cached = this.cache.get(url);
    if (cached) {
      this.touch(url);
      return cached;
    }

    const inflight = this.inflight.get(url);
    if (inflight) {
      return inflight;
    }

    const promise = this.fetchWithSemaphore(url);
    this.inflight.set(url, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(url);
    }
  }

  /** Synchronous cache read; `null` on miss. */
  peek(url: string): BackendSnapshot | null {
    return this.cache.get(url) ?? null;
  }

  /**
   * Warm a set of URLs without blocking. Already-cached or in-flight URLs are
   * skipped; errors are swallowed.
   */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) {
      if (this.cache.has(url) || this.inflight.has(url)) {
        continue;
      }
      void this.load(url);
    }
  }

  /** Drop everything (e.g. on layer teardown). */
  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  private touch(url: string): void {
    const snapshot = this.cache.get(url);
    if (!snapshot) {
      return;
    }
    this.cache.delete(url);
    this.cache.set(url, snapshot);
  }

  private put(url: string, snapshot: BackendSnapshot): void {
    this.cache.set(url, snapshot);
    while (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }

  private async fetchWithSemaphore(url: string): Promise<BackendSnapshot | null> {
    await this.acquire();
    try {
      const snapshot = await firstValueFrom(this.http.get<BackendSnapshot>(url));
      this.put(url, snapshot);
      this.loadTickSignal.update((v) => v + 1);
      return snapshot;
    } catch (err) {
      console.warn('[SmnStationsSnapshotCache] fetch failed', url, err);
      return null;
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.activeFetches < this.maxConcurrency) {
      this.activeFetches += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.activeFetches += 1;
  }

  private release(): void {
    this.activeFetches -= 1;
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }
}
