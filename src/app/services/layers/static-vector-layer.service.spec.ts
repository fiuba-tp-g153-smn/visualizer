import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Map as LeafletMap, Path, map as createMap } from 'leaflet';
import type { FeatureCollection } from 'geojson';

import { STATIC_VECTOR_PANE_PREFIX, StaticVectorLayerService } from './static-vector-layer.service';
import { VectorOverlayService } from './vector-overlay.service';
import { ActiveLayerGroupId, LayerCategory, LayerType, StaticVectorLayer } from '../../models';

const URL = '/geo/test.json';

const LAYER: StaticVectorLayer = {
  id: 'metarea-vi',
  name: 'Metarea VI',
  type: LayerType.VECTOR,
  category: LayerCategory.METAREA_VI,
  zIndexGroup: ActiveLayerGroupId.OVERLAY,
  dataUrl: URL,
  style: { color: '#123456', weight: 2, dashArray: '4 2' },
};

const LINES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'a', name: 'A' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-60, -40],
          [-50, -40],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'b', name: 'B' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-50, -40],
          [-50, -45],
        ],
      },
    },
  ],
};

/** Stand-in for VectorOverlayService: a cache plus a controllable `load`. */
class FakeVectorOverlay {
  readonly cache = new Map<string, unknown>();
  loadCalls = 0;
  result: unknown = LINES;
  private resolveLoad: (() => void) | null = null;

  peek(url: string): unknown {
    return this.cache.get(url) ?? null;
  }

  load(url: string): Promise<unknown> {
    this.loadCalls++;
    return new Promise((resolve) => {
      this.resolveLoad = () => {
        if (this.result) this.cache.set(url, this.result);
        resolve(this.result);
      };
    });
  }

  /** Completes the pending load and lets its continuations run. */
  async finishLoad(): Promise<void> {
    this.resolveLoad?.();
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe('StaticVectorLayerService', () => {
  let service: StaticVectorLayerService;
  let overlay: FakeVectorOverlay;
  let leafletMap: LeafletMap;
  let container: HTMLElement;

  const pane = (): HTMLElement => leafletMap.getPane(`${STATIC_VECTOR_PANE_PREFIX}${LAYER.id}`)!;

  beforeEach(() => {
    overlay = new FakeVectorOverlay();
    TestBed.configureTestingModule({
      providers: [{ provide: VectorOverlayService, useValue: overlay }],
    });
    service = TestBed.inject(StaticVectorLayerService);
    container = document.createElement('div');
    document.body.append(container);
    leafletMap = createMap(container).setView([-45, -55], 4);
  });

  afterEach(() => {
    leafletMap.remove();
    container.remove();
    vi.restoreAllMocks();
  });

  it('returns null and requests the file once while it is loading', () => {
    expect(service.render(LAYER, leafletMap, 1, 1500)).toBeNull();
    expect(service.render(LAYER, leafletMap, 0.5, 1500)).toBeNull();

    expect(overlay.loadCalls).toBe(1);
  });

  it('builds the layer once the file has loaded', async () => {
    service.render(LAYER, leafletMap, 1, 1500);
    await overlay.finishLoad();

    const layer = service.render(LAYER, leafletMap, 1, 1500);

    expect(layer).not.toBeNull();
    expect(layer!.getLayers()).toHaveLength(2);
  });

  it('keeps the same instance across opacity and z-index changes', async () => {
    service.render(LAYER, leafletMap, 1, 1500);
    await overlay.finishLoad();

    const first = service.render(LAYER, leafletMap, 1, 1500);
    const second = service.render(LAYER, leafletMap, 0.3, 1200);

    expect(second).toBe(first);
  });

  it('applies opacity and z-index to its own pane inside tilePane', () => {
    service.render(LAYER, leafletMap, 0.4, 1234);

    expect(pane().style.opacity).toBe('0.4');
    expect(pane().style.zIndex).toBe('1234');
    expect(pane().parentElement).toBe(leafletMap.getPane('tilePane'));
    expect(pane().style.pointerEvents).toBe('none');
  });

  it('draws every line opaque with the layer style, leaving opacity to the pane', async () => {
    service.render(LAYER, leafletMap, 0.4, 1500);
    await overlay.finishLoad();

    const layer = service.render(LAYER, leafletMap, 0.4, 1500)!;
    const paths = layer.getLayers() as Path[];

    for (const path of paths) {
      expect(path.options).toMatchObject({
        color: '#123456',
        weight: 2,
        dashArray: '4 2',
        opacity: 1,
        interactive: false,
        pane: `${STATIC_VECTOR_PANE_PREFIX}${LAYER.id}`,
      });
    }
  });

  it('does not retry a failed load until the cooldown has passed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    overlay.result = null;

    service.render(LAYER, leafletMap, 1, 1500);
    await overlay.finishLoad();
    expect(service.render(LAYER, leafletMap, 1, 1500)).toBeNull();
    expect(overlay.loadCalls).toBe(1);
    expect(warn).toHaveBeenCalledOnce();

    now.mockReturnValue(1_000_000 + 30_001);
    service.render(LAYER, leafletMap, 1, 1500);

    expect(overlay.loadCalls).toBe(2);
  });

  it('survives a malformed document without throwing, and does not rebuild it on every sync', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    overlay.cache.set(URL, { type: 'NotGeoJSON' });

    expect(() => service.render(LAYER, leafletMap, 1, 1500)).not.toThrow();
    expect(service.render(LAYER, leafletMap, 1, 1500)).toBeNull();

    expect(warn).toHaveBeenCalledOnce();
  });
});
