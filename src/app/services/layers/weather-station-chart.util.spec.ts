import { describe, it, expect } from 'vitest';

import { buildSeriesCharts, buildTabChart, buildTempDewChart } from './weather-station-chart.util';
import { WeatherStationVariable } from '../../models/layers/models';
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
    expect(vm.colors).toEqual(['#ff6b59', '#003d5c']);
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

describe('buildTabChart', () => {
  it('overlays temp + dew when Temperatura is the selected map variable', () => {
    const vm = buildTabChart(SERIES, WeatherStationVariable.TEMPERATURE, units(), {
      utc: true,
      height: 150,
    });
    expect(vm.series.map((s) => s.name)).toEqual(['Temperatura', 'Punto de rocío']);
  });

  it('shows a single line for any other selected map variable', () => {
    const vm = buildTabChart(SERIES, WeatherStationVariable.HUMIDITY, units(), {
      utc: true,
      height: 150,
    });
    expect(vm.series).toHaveLength(1);
    expect(vm.series[0].name).toBe('Humedad');
  });
});

describe('buildSeriesCharts', () => {
  it('builds one chart per variable with the palette colours and straight lines', () => {
    const charts = buildSeriesCharts(SERIES, units(), { group: 'ws-48h', utc: true, height: 200 });
    expect(charts).toHaveLength(6);
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    expect(temp.colors).toEqual(['#ff6b59']);
    expect(temp.stroke.curve).toBe('straight');
    expect(temp.chart.group).toBe('ws-48h'); // synced hover across charts
  });

  it('shows dots, no guide lines, gridded bands; wind uses direction triangles', () => {
    const charts = buildSeriesCharts(SERIES, units(), { group: 'ws-48h', utc: true, height: 200 });
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    expect(Number(temp.markers.size)).toBeGreaterThan(0); // data-point dots
    expect(temp.annotations.yaxis ?? []).toHaveLength(0);
    expect(temp.grid.column?.colors?.length).toBeGreaterThan(0); // alternating bands

    const wind = charts.find((c) => c.variable.id === 'windSpeed')!;
    expect(wind.markers.shape).toBe('triangle');
  });

  it('shows the shared time axis only on the top and bottom charts', () => {
    const charts = buildSeriesCharts(SERIES, units(), { group: 'ws-48h', utc: true, height: 200 });
    expect(charts[0].xaxis.position).toBe('top');
    expect(charts[0].xaxis.labels?.show).toBe(true);
    expect(charts[charts.length - 1].xaxis.labels?.show).toBe(true);
    expect(charts[1].xaxis.labels?.show).toBe(false); // middle hidden
  });
});
