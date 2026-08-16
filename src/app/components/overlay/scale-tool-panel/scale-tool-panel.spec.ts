import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ScaleToolPanelComponent } from './scale-tool-panel';
import { GFS_WIND_250_SCALE } from '../../../config/layers/gfs/scales.config';
import { LayerScale, ScaleType } from '../../../models';
import { ScaleToolEntry } from '../../../services/tools/scale-tools.service';

function createPanel(scale: LayerScale): ScaleToolPanelComponent {
  TestBed.configureTestingModule({});
  const panel = TestBed.runInInjectionContext(() => new ScaleToolPanelComponent());
  panel.entry = { layerName: 'Test', scale } as ScaleToolEntry;
  return panel;
}

describe('ScaleToolPanelComponent discrete labels', () => {
  it('labels every threshold of the GFS 250 hPa wind scale', () => {
    const panel = createPanel(GFS_WIND_250_SCALE);

    expect(panel.discreteLabels).toEqual([
      '210',
      '200',
      '190',
      '180',
      '170',
      '160',
      '150',
      '140',
      '130',
      '120',
      '110',
      '100',
      '90',
      '80',
    ]);
  });

  it('anchors each label to the position of the threshold it names', () => {
    const panel = createPanel(GFS_WIND_250_SCALE);
    const entries = panel.discreteLabelEntries;
    const lastIndex = entries.length - 1;

    for (const [index, entry] of entries.entries()) {
      expect(entry.top).toBeCloseTo((index / lastIndex) * 100, 6);
    }
  });

  it('keeps decimated labels on their band boundary', () => {
    const scale: LayerScale = {
      ...GFS_WIND_250_SCALE,
      type: ScaleType.DISCRETE,
      labelCount: 5,
    };
    const panel = createPanel(scale);

    expect(panel.discreteLabelEntries).toEqual([
      { text: '210', top: 0 },
      { text: '180', top: (3 / 13) * 100 },
      { text: '140', top: (7 / 13) * 100 },
      { text: '110', top: (10 / 13) * 100 },
      { text: '80', top: 100 },
    ]);
  });
});
