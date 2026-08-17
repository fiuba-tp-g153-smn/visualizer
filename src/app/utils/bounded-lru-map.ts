/**
 * A `Map` with a maximum size that evicts the least-recently-used entry once the
 * cap is exceeded. Both `get` and `set` count as a use and move the key to the
 * most-recently-used position.
 *
 * Used to bound long-lived caches (the tile-layer and weather-station marker
 * pools in `LayerRenderService`) so that a long-running dashboard session with
 * auto-refresh cannot accumulate Leaflet instances without limit. Eviction only
 * drops the cache reference — callers that still hold the value (e.g. a layer
 * currently on the map) keep it — so the least-recently-used entries evicted are
 * the stale ones no longer in use.
 */
export class BoundedLruMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error(`BoundedLruMap requires an integer maxSize >= 1 (got ${maxSize})`);
    }
  }

  get size(): number {
    return this.map.size;
  }

  /** Membership check that does NOT affect recency. */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Returns the value (marking it most-recently-used) or `undefined` if absent. */
  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key) as V;
    // Re-insert to move the key to the most-recently-used position.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** Inserts/updates the key (most-recently-used) and evicts the LRU tail if over cap. */
  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      // Map iteration is insertion order, so the first key is least-recently-used.
      const lruKey = this.map.keys().next().value as K;
      this.map.delete(lruKey);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }
}
