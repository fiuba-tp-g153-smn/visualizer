import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { ApexYAxis } from 'ng-apexcharts';

import { buildSeriesCharts, buildTabChart, buildTempDewChart } from './weather-station-chart.util';
import { WeatherStationVariable } from '../../models/layers/models';
import { WIND_SPEED_UNITS } from '../../constants';
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
  return TestBed.inject(UnitsSettingsService);
}

describe('buildTempDewChart', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
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
  beforeEach(() => TestBed.configureTestingModule({}));

  it('overlays temp + dew when Temperatura is the selected map variable', () => {
    const vm = buildTabChart(SERIES, WeatherStationVariable.TEMPERATURE, units(), {
      utc: true,
      height: 150,
    });
    expect(vm.series.map((s) => s.name)).toEqual(['Temperatura', 'Punto de rocío']);
  });

  it('overlays temp + dew when Punto de rocío is the selected map variable', () => {
    const vm = buildTabChart(SERIES, WeatherStationVariable.DEW_POINT, units(), {
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
  beforeEach(() => TestBed.configureTestingModule({}));

  it('builds one chart per variable with the palette colours and straight lines', () => {
    const charts = buildSeriesCharts(SERIES, units(), { group: 'ws-48h', utc: true, height: 200 });
    expect(charts).toHaveLength(6);
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    // Temperatura overlays the dew point, matching the popover's Temperatura graph.
    expect(temp.series.map((s) => s.name)).toEqual(['Temperatura', 'Punto de rocío']);
    expect(temp.colors).toEqual(['#ff6b59', '#003d5c']);
    expect(temp.stroke.curve).toBe('straight');
    expect(temp.chart.group).toBe('ws-48h'); // synced hover across charts

    // Only Temperatura overlays the dew point; every other variable stays single-line.
    const humidity = charts.find((c) => c.variable.id === 'humidity')!;
    expect(humidity.series).toHaveLength(1);
  });

  it('spans both temperature and dew point in the Temperatura chart y-range', () => {
    const charts = buildSeriesCharts(SERIES, units(), { group: 'ws-48h', utc: true, height: 200 });
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    // Data spans dew min 8 .. temp max 22; the snug range sits just outside that.
    expect(Number(temp.yaxis.min)).toBeLessThan(8);
    expect(Number(temp.yaxis.max)).toBeGreaterThanOrEqual(22);
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

  it('appends the wind direction to the wind chart tooltip value', () => {
    const windy: StationSeries = {
      ...SERIES,
      points: [{ ...SERIES.points[0], windSpeed: 12, windDeg: 90, windDirection: 'Este' }],
      latest: { ...SERIES.points[0], windSpeed: 12, windDeg: 90, windDirection: 'Este' },
    };
    const charts = buildSeriesCharts(windy, units(), { group: 'ws-48h', utc: true, height: 200 });
    const wind = charts.find((c) => c.variable.id === 'windSpeed')!;
    const y = wind.tooltip.y as {
      formatter: (val: number, opts: { dataPointIndex: number }) => string;
    };
    expect(y.formatter(12, { dataPointIndex: 0 })).toContain('Este');

    // The temperature chart shares the formatter shape but never appends a bearing.
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    const ty = temp.tooltip.y as {
      formatter: (val: number, opts: { dataPointIndex: number }) => string;
    };
    expect(ty.formatter(18, { dataPointIndex: 0 })).not.toContain('Este');
  });

  it('shows the shared time axis only on the top and bottom charts', () => {
    const charts = buildSeriesCharts(SERIES, units(), { group: 'ws-48h', utc: true, height: 200 });
    expect(charts[0].xaxis.position).toBe('top');
    expect(charts[0].xaxis.labels?.show).toBe(true);
    expect(charts[charts.length - 1].xaxis.labels?.show).toBe(true);
    expect(charts[1].xaxis.labels?.show).toBe(false); // middle hidden
  });
});

// ----------------------------------------------- round reference y-axis labels

function fullPoint(t: string, values: Partial<StationSeriesPoint>): StationSeriesPoint {
  return {
    t: Date.parse(t),
    observedAt: t,
    temperature: null,
    feelsLike: null,
    humidity: null,
    pressure: null,
    visibility: null,
    dewPoint: null,
    condition: null,
    windSpeed: null,
    windDeg: null,
    windDirection: null,
    ...values,
  };
}

const RICH_SERIES: StationSeries = {
  stationId: 2,
  stationName: 'Y',
  province: 'P',
  hours: 48,
  points: [
    fullPoint('2026-05-30T12:00:00Z', { humidity: 52, visibility: 6, pressure: 1011, windSpeed: 10 }),
    fullPoint('2026-05-30T15:00:00Z', { humidity: 93, visibility: 10, pressure: 1018, windSpeed: 20 }),
    fullPoint('2026-05-30T18:00:00Z', { humidity: 65, visibility: 8, pressure: 1014, windSpeed: 30 }),
  ],
  latest: fullPoint('2026-05-30T18:00:00Z', {
    humidity: 65,
    visibility: 8,
    pressure: 1014,
    windSpeed: 30,
  }),
};

function yLabels(yaxis: ApexYAxis): string[] {
  const labels = yaxis.labels as { formatter?: (val: number) => string } | undefined;
  const formatter = labels?.formatter;
  const min = Number(yaxis.min);
  const ticks = Number(yaxis.tickAmount ?? 0);
  const step = ticks > 0 ? (Number(yaxis.max) - min) / ticks : 0;
  return Array.from({ length: ticks + 1 }, (_, i) => String(formatter?.(min + i * step) ?? ''));
}

describe('buildSeriesCharts — round reference labels', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('renders whole-number humidity references despite the global decimal precision', () => {
    const u = units();
    u.setDecimalPrecision(2); // would otherwise force 2-decimal labels
    const charts = buildSeriesCharts(RICH_SERIES, u, { group: 'g', utc: true, height: 200 });
    const humidity = charts.find((c) => c.variable.id === 'humidity')!;
    expect(yLabels(humidity.yaxis).every((l) => !l.includes('.'))).toBe(true);
  });

  it('floors the visibility axis at 0', () => {
    const charts = buildSeriesCharts(RICH_SERIES, units(), { group: 'g', utc: true, height: 200 });
    const visibility = charts.find((c) => c.variable.id === 'visibility')!;
    expect(Number(visibility.yaxis.min)).toBe(0);
    expect(yLabels(visibility.yaxis).every((l) => !l.includes('.'))).toBe(true);
  });

  it('uses 0.5-granularity wind references in knots', () => {
    const u = units();
    u.setWindSpeedUnit(WIND_SPEED_UNITS.KNOTS);
    const charts = buildSeriesCharts(RICH_SERIES, u, { group: 'g', utc: true, height: 200 });
    const wind = charts.find((c) => c.variable.id === 'windSpeed')!;
    // Every reference is a multiple of 0.5 (no finer-than-.5 fractions).
    expect(Number.isInteger(Number(wind.yaxis.min) * 2)).toBe(true);
    expect(Number.isInteger(Number(wind.yaxis.max) * 2)).toBe(true);
    expect(yLabels(wind.yaxis).every((l) => /^\d+(\.5)?$/.test(l))).toBe(true);
  });

  it('uses whole-number wind references in km/h', () => {
    const u = units();
    u.setWindSpeedUnit(WIND_SPEED_UNITS.KILOMETERS_PER_HOUR);
    const charts = buildSeriesCharts(RICH_SERIES, u, { group: 'g', utc: true, height: 200 });
    const wind = charts.find((c) => c.variable.id === 'windSpeed')!;
    expect(yLabels(wind.yaxis).every((l) => !l.includes('.'))).toBe(true);
  });
});
