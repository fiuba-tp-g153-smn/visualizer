import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GeoJSON, Map as LeafletMap, layerGroup, map as createMap } from 'leaflet';
import type { FeatureCollection } from 'geojson';

import { MapLayersService, stepPublishesOverlay } from './map-layers.service';
import { LayerConfigService } from './layer-config.service';
import { LayerControlService } from './layer-control.service';
import { LayerRenderService } from './layer-render.service';
import { LayersService } from './layers.service';
import { STATIC_VECTOR_PANE_PREFIX, StaticVectorLayerService } from './static-vector-layer.service';
import { VectorOverlayService } from './vector-overlay.service';
import {
  ActiveLayerGroupId,
  Layer,
  LayerCategory,
  LayerControls,
  LayerType,
  SecondaryVectorRender,
  StaticVectorLayer,
  WrfTileLayerConfig,
} from '../../models';

const RUN = '20260808T0600Z';
const STEP = 'f003';

function config(layersByStep: Record<string, readonly string[]>): WrfTileLayerConfig {
  return {
    layerId: 'gfs/mean-sea-level-pressure',
    type: LayerType.TILE,
    category: LayerCategory.WRF,
    availableTilesets: [],
    availableForecasts: [RUN],
    periodsByForecast: { [RUN]: [STEP] },
    forecastsByPeriod: {},
    layersByStep,
  };
}

function render(backendLayerName?: string): SecondaryVectorRender {
  return {
    id: 'gfs-mslp-isobars',
    buildUrl: () => '',
    backendLayerName,
    valueProperty: 'pressure_hpa',
    styleFor: () => ({ color: '#000', weight: 1 }),
    labelFor: () => null,
  };
}

describe('stepPublishesOverlay', () => {
  it('renders an overlay the step advertises', () => {
    const cfg = config({ [`${RUN}/${STEP}`]: ['isobars', 'thickness'] });
    expect(stepPublishesOverlay(cfg, RUN, STEP, render('isobars'))).toBe(true);
  });

  it('skips an overlay the step has not uploaded yet', () => {
    const cfg = config({ [`${RUN}/${STEP}`]: ['thickness'] });
    expect(stepPublishesOverlay(cfg, RUN, STEP, render('isobars'))).toBe(false);
  });

  it('falls open when the step is not in the index at all', () => {
    expect(stepPublishesOverlay(config({}), RUN, STEP, render('isobars'))).toBe(true);
  });

  it('falls open for a render that declares no backend name', () => {
    expect(
      stepPublishesOverlay(config({ [`${RUN}/${STEP}`]: ['thickness'] }), RUN, STEP, render()),
    ).toBe(true);
  });

  it('keys the lookup by run and step, not by step alone', () => {
    const other = '20260808T0000Z';
    const cfg = config({
      [`${RUN}/${STEP}`]: ['isobars'],
      [`${other}/${STEP}`]: [],
    });
    expect(stepPublishesOverlay(cfg, RUN, STEP, render('isobars'))).toBe(true);
    expect(stepPublishesOverlay(cfg, other, STEP, render('isobars'))).toBe(false);
  });
});

describe('MapLayersService — static vector layers', () => {
  const STATIC: StaticVectorLayer = {
    id: 'metarea-vi',
    name: 'Metarea VI',
    type: LayerType.VECTOR,
    category: LayerCategory.METAREA_VI,
    zIndexGroup: ActiveLayerGroupId.OVERLAY,
    dataUrl: '/geo/metarea-vi.json',
    style: { color: '#123456', weight: 2 },
  };
  const STATIONS = {
    id: 'smn/temperature',
    name: 'Temperatura',
    type: LayerType.VECTOR,
    category: LayerCategory.WEATHER_STATIONS,
    zIndexGroup: ActiveLayerGroupId.POINTS,
  } as unknown as Layer;
  const LINES: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [-60, -40],
            [-50, -40],
          ],
        },
      },
    ],
  };

  let service: MapLayersService;
  let leafletMap: LeafletMap;
  let container: HTMLElement;
  let controls: Record<string, LayerControls>;
  const createWeatherStationsLayer = vi.fn(() => layerGroup());

  const controlsFor = (opacity: number): LayerControls =>
    ({ type: LayerType.VECTOR, visible: true, opacity, zIndex: 0 }) as unknown as LayerControls;
  const staticInstance = (): GeoJSON =>
    TestBed.inject(StaticVectorLayerService).render(STATIC, leafletMap, 1, 1500)!;

  beforeEach(() => {
    const layers: Record<string, Layer> = { [STATIC.id]: STATIC, [STATIONS.id]: STATIONS };
    controls = { [STATIC.id]: controlsFor(1), [STATIONS.id]: controlsFor(1) };
    createWeatherStationsLayer.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: LayersService, useValue: { getLayerById: (id: string) => layers[id] } },
        {
          provide: LayerControlService,
          useValue: {
            getControls: (id: string) => controls[id],
            getAbsoluteZIndex: () => 1500,
          },
        },
        { provide: LayerConfigService, useValue: { hasConfig: () => true } },
        { provide: LayerRenderService, useValue: { createWeatherStationsLayer } },
        {
          provide: VectorOverlayService,
          useValue: {
            peek: (url: string) => (url === STATIC.dataUrl ? LINES : null),
            load: () => Promise.resolve(LINES),
          },
        },
      ],
    });
    service = TestBed.inject(MapLayersService);
    container = document.createElement('div');
    document.body.append(container);
    leafletMap = createMap(container).setView([-45, -55], 4);
    service.initialize(leafletMap);
  });

  afterEach(() => {
    leafletMap.remove();
    container.remove();
  });

  it('renders a METAREA_VI layer through the static vector path, not the stations one', () => {
    service.syncLayers([STATIC.id]);

    expect(leafletMap.hasLayer(staticInstance())).toBe(true);
    expect(createWeatherStationsLayer).not.toHaveBeenCalled();
  });

  it('keeps the same layer on the map when only the opacity changes', () => {
    service.syncLayers([STATIC.id]);
    const removeLayer = vi.spyOn(leafletMap, 'removeLayer');

    controls[STATIC.id] = controlsFor(0.25);
    service.syncLayers([STATIC.id]);

    expect(removeLayer).not.toHaveBeenCalled();
    expect(leafletMap.getPane(`${STATIC_VECTOR_PANE_PREFIX}${STATIC.id}`)!.style.opacity).toBe(
      '0.25',
    );
  });

  it('removes the layer when it is deactivated', () => {
    service.syncLayers([STATIC.id]);
    service.syncLayers([]);

    expect(leafletMap.hasLayer(staticInstance())).toBe(false);
  });

  it('still renders weather-station layers through createWeatherStationsLayer', () => {
    service.syncLayers([STATIONS.id]);

    expect(createWeatherStationsLayer).toHaveBeenCalledOnce();
  });
});
