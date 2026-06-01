import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WeatherStationsPrefetchService } from './weather-stations-prefetch.service';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('WeatherStationsPrefetchService', () => {
  let service: WeatherStationsPrefetchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherStationsPrefetchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('issues one GET per url to warm the browser cache', () => {
    service.prefetch(['a', 'b']);
    httpMock.expectOne('a').flush('{}');
    httpMock.expectOne('b').flush('{}');
  });

  it('collapses concurrent warms of the same url into a single request', () => {
    service.prefetch(['a', 'a', 'a']);
    httpMock.expectOne('a').flush('{}'); // exactly one in flight
  });

  it('does not throw when a warm fails, and frees the url for a later retry', async () => {
    service.prefetch(['a']);
    httpMock.expectOne('a').flush('boom', { status: 500, statusText: 'Server Error' });
    await tick(); // let the settle handler clear the in-flight entry

    service.prefetch(['a']); // no longer in flight → a fresh warm is issued
    httpMock.expectOne('a').flush('{}');
  });
});
