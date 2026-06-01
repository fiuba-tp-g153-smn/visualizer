import { describe, it, expect } from 'vitest';

import { buildTempDewChart } from './weather-station-chart.util';
import { UnitsSettingsService } from '../settings/units-settings.service';
import type {
  StationSeries,
  StationSeriesPoint,
} from '../../models/geo/weather-station-series.model';

function point(t: string, temperature: number | null, dewPoint: number | null): StationSeriesPoint {
  return {
    t: Date.parse(t),
    observedAt: t,
    temperature,
    feelsLike: null,
    humidity: null,
    pressure: null,
    visibility: null,
    dewPoint,
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
  points: [
    point('2026-05-30T12:00:00Z', 18, 9),
    point('2026-05-30T15:00:00Z', 22, 11),
    point('2026-05-30T18:00:00Z', 14, 8),
  ],
  latest: point('2026-05-30T18:00:00Z', 14, 8),
};

function units(): UnitsSettingsService {
  return new UnitsSettingsService();
}

describe('buildTempDewChart', () => {
  it('overlays Temperatura and Punto de rocío as two straight-line series', () => {
    const vm = buildTempDewChart(SERIES, units(), { utc: true, height: 200 });
    expect(vm.series).toHaveLength(2);
    expect(vm.series.map((s) => s.name)).toEqual(['Temperatura', 'Punto de rocío']);
    expect(vm.colors).toEqual(['#e63946', '#2a9d8f']);
    expect(vm.stroke.curve).toBe('straight');
    expect(vm.hasData).toBe(true);
  });

  it('uses a tight y-range spanning both temperature and dew point', () => {
    const vm = buildTempDewChart(SERIES, units(), { utc: true, height: 200 });
    // Data spans dew min 8 .. temp max 22; the snug range sits just outside that.
    expect(Number(vm.yaxis.min)).toBeGreaterThan(0);
    expect(Number(vm.yaxis.min)).toBeLessThan(8);
    expect(Number(vm.yaxis.max)).toBeGreaterThanOrEqual(22);
  });

  it('reports no data when both series are empty', () => {
    const empty: StationSeries = { ...SERIES, points: [], latest: null };
    const vm = buildTempDewChart(empty, units(), { utc: true, height: 200 });
    expect(vm.hasData).toBe(false);
  });
});
