import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { buildSeriesSummary } from './weather-station-summary.util';
import { UnitsSettingsService } from '../settings/units-settings.service';
import type {
  StationSeries,
  StationSeriesPoint,
} from '../../models/geo/weather-station-series.model';

function pt(temperature: number | null, humidity: number | null): StationSeriesPoint {
  return {
    t: 0,
    observedAt: '2026-05-30T12:00:00Z',
    temperature,
    feelsLike: null,
    humidity,
    pressure: null,
    visibility: null,
    dewPoint: null,
    condition: null,
    windSpeed: null,
    windDeg: null,
    windDirection: null,
  };
}

const SERIES: StationSeries = {
  stationId: 1,
  stationName: 'X',
  province: 'P',
  hours: 48,
  points: [pt(10, 50), pt(20, 70), pt(15, 60)],
  latest: pt(15, 60),
};

const units = () => TestBed.inject(UnitsSettingsService);

describe('buildSeriesSummary', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  it('computes max/min/avg for a variable with data', () => {
    const groups = buildSeriesSummary(SERIES, units());
    const temp = groups.find((g) => g.title.startsWith('Temperatura'))!;
    const byLabel = Object.fromEntries(temp.rows.map((r) => [r.label, r.value]));
    expect(byLabel['Máxima']).toBe('20.0');
    expect(byLabel['Mínima']).toBe('10.0');
    expect(byLabel['Promedio']).toBe('15.0');
  });

  it('drops variables with no readings', () => {
    const groups = buildSeriesSummary(SERIES, units());
    // pressure/visibility/dewPoint/feelsLike/wind are all null here → omitted.
    expect(groups.map((g) => g.title.split(' (')[0])).toEqual(['Temperatura', 'Humedad']);
  });
});
