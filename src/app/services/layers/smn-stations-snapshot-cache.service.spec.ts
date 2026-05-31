import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SmnStationsSnapshotCacheService } from './smn-stations-snapshot-cache.service';
import { BackendSnapshot } from './weather-stations-backend.types';

function snap(scrapedAt: string): BackendSnapshot {
  return { scraped_at: scrapedAt, source_url: 'https://api.test', stations: [] };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('SmnStationsSnapshotCacheService', () => {
  let service: SmnStationsSnapshotCacheService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SmnStationsSnapshotCacheService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('caches a loaded snapshot — a second load issues no request', async () => {
    const first = service.load('u1');
    await tick(); // the semaphore defers the request by a microtask
    httpMock.expectOne('u1').flush(snap('t1'));
    expect(await first).toEqual(snap('t1'));

    const second = await service.load('u1');
    expect(second).toEqual(snap('t1'));
    httpMock.expectNone('u1'); // served from cache
    expect(service.peek('u1')).toEqual(snap('t1'));
  });

  it('dedupes concurrent loads of the same url into one request', async () => {
    const a = service.load('u1');
    const b = service.load('u1');
    await tick();
    httpMock.expectOne('u1').flush(snap('t1')); // exactly one request
    expect(await a).toEqual(snap('t1'));
    expect(await b).toEqual(snap('t1'));
  });

  it('prefetch warms uncached urls and skips already-cached ones', async () => {
    service.prefetch(['a', 'b']);
    await tick();
    httpMock.expectOne('a').flush(snap('ta'));
    httpMock.expectOne('b').flush(snap('tb'));
    await tick();

    service.prefetch(['a', 'b']); // both cached now → no new requests
    httpMock.expectNone('a');
    httpMock.expectNone('b');
    expect(service.peek('a')).toEqual(snap('ta'));
  });

  it('resolves to null on fetch error and does not cache it', async () => {
    const p = service.load('u1');
    await tick();
    httpMock.expectOne('u1').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(await p).toBeNull();
    expect(service.peek('u1')).toBeNull();
  });

  it('evicts the oldest entry past the cache bound (LRU)', async () => {
    // Sequential loads keep one request open at a time. The bound is 48, so the
    // 49th insertion evicts the first.
    for (let i = 0; i <= 48; i++) {
      const p = service.load(`url-${i}`);
      await tick();
      httpMock.expectOne(`url-${i}`).flush(snap(`t-${i}`));
      await p;
    }
    expect(service.peek('url-0')).toBeNull(); // evicted
    expect(service.peek('url-48')).toEqual(snap('t-48'));
  });
});
