import { describe, expect, it } from 'vitest';

import { stepPublishesOverlay } from './map-layers.service';
import { LayerCategory, LayerType, SecondaryVectorRender, WrfTileLayerConfig } from '../../models';

const RUN = '20260808T0600Z';
const STEP = 'f003';

function config(layersByStep: Record<string, readonly string[]>): WrfTileLayerConfig {
  return {
    layerId: 'gfs/mslp',
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
