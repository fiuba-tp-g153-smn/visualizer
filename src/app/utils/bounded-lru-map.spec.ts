import { describe, it, expect } from 'vitest';

import { BoundedLruMap } from './bounded-lru-map';

describe('BoundedLruMap', () => {
  it('rejects a non-positive or non-integer maxSize', () => {
    expect(() => new BoundedLruMap<string, number>(0)).toThrow();
    expect(() => new BoundedLruMap<string, number>(-1)).toThrow();
    expect(() => new BoundedLruMap<string, number>(1.5)).toThrow();
  });

  it('stores and retrieves values', () => {
    const cache = new BoundedLruMap<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.has('a')).toBe(true);
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it('never grows beyond maxSize no matter how many distinct keys are added', () => {
    // This is the leak-fix guarantee: the tile/marker pools embed an
    // ever-changing tilesetId / fetchedAt in the key, so without a cap they grow
    // without bound over a long auto-refreshing session. Simulate 10_000 refreshes.
    const cache = new BoundedLruMap<string, number>(200);
    for (let i = 0; i < 10_000; i++) {
      cache.set(`tileset-${i}`, i);
      expect(cache.size).toBeLessThanOrEqual(200);
    }
    expect(cache.size).toBe(200);
    // Only the most recent 200 keys survive.
    expect(cache.has('tileset-9999')).toBe(true);
    expect(cache.has('tileset-9800')).toBe(true);
    expect(cache.has('tileset-9799')).toBe(false);
    expect(cache.has('tileset-0')).toBe(false);
  });

  it('evicts the least-recently-used entry when full', () => {
    const cache = new BoundedLruMap<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // overflows → evicts 'a' (LRU)

    expect(cache.has('a')).toBe(false);
    expect([...cache.keys()]).toEqual(['b', 'c', 'd']);
  });

  it('get() marks an entry most-recently-used, protecting it from eviction', () => {
    const cache = new BoundedLruMap<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Touch 'a' so it is no longer the LRU entry.
    expect(cache.get('a')).toBe(1);

    cache.set('d', 4); // now 'b' is the LRU entry, not 'a'
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect([...cache.keys()]).toEqual(['c', 'a', 'd']);
  });

  it('re-setting an existing key updates its value and recency without growing', () => {
    const cache = new BoundedLruMap<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10); // update + touch, not a new entry

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(10);

    cache.set('c', 3); // evicts 'b' (LRU), not the just-touched 'a'
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('supports delete and clear', () => {
    const cache = new BoundedLruMap<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('a')).toBe(false);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
