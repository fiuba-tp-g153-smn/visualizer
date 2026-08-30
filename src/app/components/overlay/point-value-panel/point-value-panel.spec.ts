import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { PointValuePanelComponent } from './point-value-panel';
import { UnitsSettingsService } from '../../../services/settings/units-settings.service';

function createPanel(): PointValuePanelComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: UnitsSettingsService,
        useValue: { decimalPrecision: () => 1, temperatureUnit: () => 'celsius' },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new PointValuePanelComponent());
}

describe('PointValuePanelComponent', () => {
  it('has no run line or period line by default', () => {
    const panel = createPanel();
    expect(panel.runLine).toBeNull();
    expect(panel.periodLine).toBeNull();
  });

  it('shows the current instant on the period line for satellite/radar', () => {
    const panel = createPanel();
    panel.periodLabel = '23/08/2026 14:00';
    expect(panel.periodLine).toBe('23/08/2026 14:00');
    expect(panel.runLine).toBeNull();
  });

  it('shows both the run and the current instant for a forecast-model layer', () => {
    const panel = createPanel();
    panel.runLabel = '23/08/2026 12:00';
    panel.periodLabel = '23/08/2026 18:00';
    expect(panel.runLine).toBe('Corrida 23/08/2026 12:00');
    expect(panel.periodLine).toBe('23/08/2026 18:00');
  });

  it('prepends the elevation before the period', () => {
    const panel = createPanel();
    panel.elevationLabel = '0.5°';
    panel.periodLabel = '23/08/2026 14:00';
    expect(panel.periodLine).toBe('0.5° · 23/08/2026 14:00');
  });

  it('leads the period line with "Reproduciéndose" while playing', () => {
    const panel = createPanel();
    panel.isPlaying = true;
    panel.elevationLabel = '0.5°';
    panel.periodLabel = '23/08/2026 14:00';
    expect(panel.periodLine).toBe('Reproduciéndose · 0.5° · 23/08/2026 14:00');
  });

  describe('detailSlots', () => {
    it('renders no slots when there is nothing to show and no row minimum', () => {
      const panel = createPanel();
      expect(panel.detailSlots).toEqual([]);
    });

    it('renders only the real lines when they already meet the row minimum', () => {
      const panel = createPanel();
      panel.runLabel = '23/08/2026 12:00';
      panel.periodLabel = '23/08/2026 18:00';
      panel.minDetailLines = 2;
      expect(panel.detailSlots).toEqual([
        { text: 'Corrida 23/08/2026 12:00', blank: false },
        { text: '23/08/2026 18:00', blank: false },
      ]);
    });

    it('pads with a blank slot up to the row minimum when it has fewer real lines', () => {
      const panel = createPanel();
      panel.periodLabel = '23/08/2026 14:00';
      panel.minDetailLines = 2;
      const slots = panel.detailSlots;
      expect(slots[0]).toEqual({ text: '23/08/2026 14:00', blank: false });
      expect(slots[1].blank).toBe(true);
    });

    it('never trims real lines below the row minimum', () => {
      const panel = createPanel();
      panel.runLabel = '23/08/2026 12:00';
      panel.periodLabel = '23/08/2026 18:00';
      panel.minDetailLines = 0;
      expect(panel.detailSlots).toEqual([
        { text: 'Corrida 23/08/2026 12:00', blank: false },
        { text: '23/08/2026 18:00', blank: false },
      ]);
    });
  });
});
