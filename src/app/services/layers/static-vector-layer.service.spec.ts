import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GeoJSON, Map as LeafletMap, Marker, Path, map as createMap } from 'leaflet';
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

function point(coordinates: [number, number], properties: Record<string, unknown>) {
  return {
    type: 'Feature' as const,
    properties,
    geometry: { type: 'Point' as const, coordinates },
  };
}

/** Lines plus a coastal label (minZoom 5), an oceanic one (no minZoom) and an unlabelled point. */
const WITH_LABELS: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    ...LINES.features,
    point([-55, -42], { id: 'a', label: 'A', minZoom: 5 }),
    point([-35, -38], { id: 'norte', label: 'NORTE' }),
    point([-45, -50], { id: 'no-label' }),
  ],
};

const labelMarkers = (layer: GeoJSON): Marker[] =>
  layer.getLayers().filter((l): l is Marker => l instanceof Marker);

const labelText = (layer: GeoJSON, text: string): Marker => {
  const found = labelMarkers(layer).find((m) => m.getElement()?.textContent === text);
  if (!found) throw new Error(`label '${text}' not found`);
  return found;
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

  describe('labels', () => {
    const renderLabelled = (): GeoJSON => {
      overlay.cache.set(URL, WITH_LABELS);
      return service.render(LAYER, leafletMap, 1, 1500)!;
    };

    it('draws only labelled points, as non-interactive text in the layer pane', () => {
      const layer = renderLabelled().addTo(leafletMap);

      const markers = labelMarkers(layer);
      expect(markers).toHaveLength(2);
      for (const m of markers) {
        expect(m.options).toMatchObject({ interactive: false, keyboard: false });
        expect(m.getElement()!.parentElement).toBe(pane());
      }
      expect(labelText(layer, 'NORTE')).toBeDefined();
    });

    it('inserts the label as text, never as markup', () => {
      overlay.cache.set(URL, {
        type: 'FeatureCollection',
        features: [point([-40, -40], { label: '<b>X</b>' })],
      });
      const layer = service.render(LAYER, leafletMap, 1, 1500)!.addTo(leafletMap);

      const element = labelMarkers(layer)[0].getElement()!;
      expect(element.querySelector('b')).toBeNull();
      expect(element.textContent).toBe('<b>X</b>');
    });

    it('hides a label below its minZoom, even before the layer is on the map', () => {
      const layer = renderLabelled().addTo(leafletMap); // map at zoom 4

      expect(labelText(layer, 'A').getElement()!.style.opacity).toBe('0');
      expect(labelText(layer, 'NORTE').options.opacity).toBe(1);
    });

    it('shows it from its minZoom on, without rebuilding the layer', () => {
      const first = renderLabelled().addTo(leafletMap);

      leafletMap.setView([-45, -55], 5, { animate: false });
      const second = service.render(LAYER, leafletMap, 1, 1500)!;

      expect(second).toBe(first);
      expect(labelText(second, 'A').getElement()!.style.opacity).toBe('1');
    });
  });
});
