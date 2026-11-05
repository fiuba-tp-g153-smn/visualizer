import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PointQueryViewerService } from './point-query-viewer.service';
import { LayerControlService } from '../layers/layer-control.service';
import { LayerConfigService } from '../layers/layer-config.service';
import { LayersService } from '../layers/layers.service';
import { MapInfoService } from '../layers/map-info.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { TimezoneSettingsService } from '../settings/timezone-settings.service';
import {
  ABIGoesTileLayer,
  ActiveLayerEntry,
  ActiveLayerGroupId,
  GoesLayerControls,
  LayerCategory,
  LayerType,
  PointQueryStatus,
  ScaleType,
} from '../../models';

const tileset = (id: string, minutes: number) => ({
  id,
  time: new Date(Date.UTC(2026, 0, 1, 12, minutes)),
});

const TILESETS = ['t0', 't1', 't2', 't3', 't4', 't5'].map((id, i) => tileset(id, i * 10));

/** What the config currently offers; a refresh can shift it (new image in, oldest out). */
let tilesets = TILESETS;

const goesLayer: ABIGoesTileLayer = {
  id: 'goes/abi/c13',
  name: 'Canal 13',
  type: LayerType.TILE,
  category: LayerCategory.GOES_19,
  isForecast: false,
  channel: 'c13',
  minNativeZoom: 0,
  maxNativeZoom: 8,
  zIndexGroup: ActiveLayerGroupId.BASE,
  scale: {
    type: ScaleType.CONTINUOUS,
    unit: 'K',
    entries: [
      { value: 180, color: '#000' },
      { value: 330, color: '#fff' },
    ],
  },
};

function controlsAt(timeIndex: number, isPlaying = false): GoesLayerControls {
  return {
    id: goesLayer.id,
    type: LayerType.TILE,
    category: LayerCategory.GOES_19,
    visible: true,
    opacity: 1,
    zIndex: 1,
    playback: { isPlaying, timeIndex, speed: 1, imageCount: 3 },
  };
}

describe('PointQueryViewerService', () => {
  let service: PointQueryViewerService;
  let http: HttpTestingController;
  let activeLayers: WritableSignal<ActiveLayerEntry[]>;

  /** Moves the layer to `timeIndex` and lets the frame-key effect run. */
  function showFrame(timeIndex: number, isPlaying = false): void {
    activeLayers.set([{ layer: goesLayer, controls: controlsAt(timeIndex, isPlaying) }]);
    TestBed.tick();
  }

  /** `http.match` hands requests over once, so keep the open ones here. */
  let open: TestRequest[] = [];

  function collect(): void {
    open = [...open, ...http.match(() => true)].filter((req) => !req.cancelled);
  }

  function pendingFrames(): string[] {
    collect();
    return open.map(
      (req) => req.request.urlWithParams.match(/t\d+|tnew/)?.[0] ?? req.request.urlWithParams,
    );
  }

  /** Answers the oldest open request. */
  function respond(value: number): void {
    collect();
    open.shift()!.flush({ value, unit: 'K' });
    TestBed.tick();
  }

  function fail(): void {
    collect();
    open.shift()!.flush('boom', { status: 500, statusText: 'Server Error' });
    TestBed.tick();
  }

  const entry = () => service.floatingViewerEntries()[0];

  beforeEach(() => {
    activeLayers = signal<ActiveLayerEntry[]>([]);
    open = [];
    tilesets = TILESETS;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LayerControlService, useValue: { activeLayers } },
        {
          provide: LayerConfigService,
          useValue: {
            getConfig: () => ({ type: LayerType.TILE, availableTilesets: tilesets }),
            getAvailableTilesets: () => tilesets,
          },
        },
        {
          provide: LayersService,
          useValue: {
            getLayerById: () => goesLayer,
            getLayerFullName: () => 'GOES-19 Canal 13',
          },
        },
        { provide: MapInfoService, useValue: { setQueryMarkerPosition: () => undefined } },
        {
          provide: LocalStorageService,
          useValue: { getJson: () => null, setJson: () => undefined, remove: () => undefined },
        },
        { provide: TimezoneSettingsService, useValue: { mode: signal('hoa') } },
      ],
    });

    service = TestBed.inject(PointQueryViewerService);
    http = TestBed.inject(HttpTestingController);
    service.initialize();
    showFrame(0);
    service.handleMapClick(-34.6, -58.4, 0);
    TestBed.tick();
  });

  afterEach(() => {
    collect();
    open.forEach((req) => req.flush({ value: 0, unit: 'K' }));
    http.verify({ ignoreCancelled: true });
  });

  it('queries the clicked point for the current frame', () => {
    expect(pendingFrames()).toEqual(['t0']);
    expect(entry().isLoading).toBe(true);

    respond(250);

    expect(entry()).toMatchObject({ isLoading: false, data: { value: 250 } });
  });

  it('queries again when the frame changes, keeping the previous value meanwhile', () => {
    respond(250);

    showFrame(1);

    expect(pendingFrames()).toEqual(['t1']);
    expect(entry()).toMatchObject({ isLoading: true, data: { value: 250 } });

    respond(260);
    expect(entry()).toMatchObject({ isLoading: false, data: { value: 260 } });
  });

  it('shows a cached frame without a new request', () => {
    respond(250);
    showFrame(1);
    respond(260);

    showFrame(0);

    expect(pendingFrames()).toEqual([]);
    expect(entry()).toMatchObject({ isLoading: false, data: { value: 250 } });
  });

  it('keeps querying while playing instead of hiding the value', () => {
    respond(250);

    showFrame(1, true);

    expect(entry().isPlaying).toBe(true);
    expect(pendingFrames()).toEqual(['t1']);
    respond(260);
    expect(entry()).toMatchObject({ isLoading: false, data: { value: 260 } });
  });

  it('does not show a late result for a frame that is no longer current', () => {
    showFrame(1);
    showFrame(2);
    expect(pendingFrames()).toEqual(['t0', 't1', 't2']);

    respond(250);

    expect(entry().data).toBeNull();
    expect(entry().isLoading).toBe(true);
  });

  it('shows errors without caching them, so the frame is retried later', () => {
    fail();
    expect(entry().data?.status).toBe(PointQueryStatus.ERROR);

    showFrame(1);
    respond(260);
    showFrame(0);

    expect(pendingFrames()).toEqual(['t0']);
    respond(250);
  });

  it('retries a displayed error when coming back to its frame', () => {
    fail();
    showFrame(1); // t1 stays in flight, the t0 error is still on screen

    showFrame(0);

    expect(pendingFrames()).toEqual(['t1', 't0']);
  });

  it('queries a queued frame with the source as it is when the batch starts', () => {
    // t0 is in flight; t1–t3 fill the remaining slots and t4 queues behind them.
    [1, 2, 3, 4].forEach((i) => showFrame(i));
    expect(pendingFrames()).toEqual(['t0', 't1', 't2', 't3']);

    // A refresh drops t0 and adds a new image: t4 moves from index 4 to 3.
    tilesets = [...TILESETS.slice(1), tileset('tnew', 60)];
    showFrame(3);

    respond(250); // frees a slot for the queued t4 batch

    expect(pendingFrames()).toEqual(['t1', 't2', 't3', 't4']);
  });
});
