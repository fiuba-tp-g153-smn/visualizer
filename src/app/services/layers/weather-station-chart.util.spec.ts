import { describe, it, expect } from 'vitest';

import { buildSeriesCharts } from './weather-station-chart.util';
import { UnitsSettingsService } from '../settings/units-settings.service';
import type {
  StationSeries,
  StationSeriesPoint,
} from '../../models/geo/weather-station-series.model';

function point(t: string, temperature: number | null): StationSeriesPoint {
  return {
    t: Date.parse(t),
    observedAt: t,
    temperature,
    feelsLike: null,
    humidity: null,
    pressure: null,
    visibility: null,
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
    point('2026-05-30T12:00:00Z', 10),
    point('2026-05-30T15:00:00Z', 18),
    point('2026-05-30T18:00:00Z', 6),
  ],
  latest: point('2026-05-30T18:00:00Z', 6),
};

function units(): UnitsSettingsService {
  return new UnitsSettingsService();
}

describe('buildSeriesCharts', () => {
  it('uses straight lines (no smoothing) on every chart', () => {
    const charts = buildSeriesCharts(SERIES, units(), {
      group: 'g',
      sparkline: false,
      utc: true,
      height: 200,
    });
    expect(charts).toHaveLength(6);
    for (const vm of charts) {
      expect(vm.stroke.curve).toBe('straight');
    }
  });

  it('adds labeled max & min guide lines from the series values', () => {
    const charts = buildSeriesCharts(SERIES, units(), {
      group: 'g',
      sparkline: false,
      utc: true,
      height: 200,
    });
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    const lines = temp.annotations.yaxis ?? [];
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.y).sort((a, b) => Number(a) - Number(b))).toEqual([6, 18]);
    // Variables with no readings get no guide lines.
    const humidity = charts.find((c) => c.variable.id === 'humidity')!;
    expect(humidity.hasData).toBe(false);
    expect(humidity.annotations.yaxis ?? []).toHaveLength(0);
  });

  it('shows the x-axis on only the last chart with data in compact mode (shared timeline)', () => {
    const charts = buildSeriesCharts(SERIES, units(), {
      group: 'g',
      sparkline: true,
      utc: false,
      height: 46,
    });
    // Only `temperature` has data here, so it carries the shared timeline.
    const temp = charts.find((c) => c.variable.id === 'temperature')!;
    expect(temp.xaxis.labels?.show).toBe(true);

    const others = charts.filter((c) => c.variable.id !== 'temperature');
    for (const vm of others) {
      expect(vm.xaxis.labels?.show).toBe(false);
    }
  });

  it('shows data-point dots on the full-screen charts and hides them on the popover', () => {
    const full = buildSeriesCharts(SERIES, units(), {
      group: 'ws-48h',
      sparkline: false,
      utc: true,
      height: 200,
    });
    expect(full[0].markers.size).toBeGreaterThan(0);

    const compact = buildSeriesCharts(SERIES, units(), {
      group: 'ws-48h-preview',
      sparkline: true,
      utc: false,
      height: 30,
    });
    expect(compact[0].markers.size).toBe(0);
  });

  it('groups the full-screen charts for synchronized hover but not the popover ones', () => {
    const full = buildSeriesCharts(SERIES, units(), {
      group: 'ws-48h',
      sparkline: false,
      utc: true,
      height: 200,
    });
    const ids = full.map((c) => c.chart.id);
    expect(new Set(ids).size).toBe(full.length); // all unique
    for (const vm of full) {
      expect(vm.chart.group).toBe('ws-48h');
    }

    // Compact popover charts opt out of the group → no crowded multi-hover.
    const compact = buildSeriesCharts(SERIES, units(), {
      group: 'ws-48h-preview',
      sparkline: true,
      utc: false,
      height: 30,
    });
    for (const vm of compact) {
      expect(vm.chart.group).toBeUndefined();
    }
  });

  it('sets an explicit width when provided (popover renders while detached)', () => {
    const charts = buildSeriesCharts(SERIES, units(), {
      group: 'ws-48h-preview',
      sparkline: true,
      utc: false,
      height: 30,
      width: 184,
    });
    expect(charts[0].chart.width).toBe(184);
  });
});
