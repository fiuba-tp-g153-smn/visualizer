import { describe, it, expect } from 'vitest';

import type { ThroughputBucket, TimingSeriesPoint } from '../../models/metrics/metrics.models';
import {
  buildLineChart,
  buildStageAreaChart,
  buildStagePieChart,
  buildThroughputBarChart,
  buildTypeColorMap,
  pivot,
  typeColor,
} from './metrics-chart.util';

const THROUGHPUT: ThroughputBucket[] = [
  { bucket: 'b1', job_type: 'a', count: 2 },
  { bucket: 'b1', job_type: 'b', count: 5 },
  { bucket: 'b2', job_type: 'a', count: 3 },
];

describe('pivot', () => {
  it('groups flat rows into sorted buckets/types with a lookup', () => {
    const p = pivot(THROUGHPUT, 'count');
    expect(p.buckets).toEqual(['b1', 'b2']);
    expect(p.types).toEqual(['a', 'b']);
    expect(p.at('b1', 'a')).toBe(2);
    expect(p.at('b1', 'b')).toBe(5);
    expect(p.at('b2', 'b')).toBeNull(); // missing cell
  });
});

describe('typeColor', () => {
  it('is deterministic and returns a hex from the palette', () => {
    expect(typeColor('radar_DBZH')).toBe(typeColor('radar_DBZH'));
    expect(typeColor('radar_DBZH')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('buildTypeColorMap', () => {
  it('gives a type the same color regardless of input order (stable)', () => {
    const a = buildTypeColorMap(['radar_DBZH', 'goes_band_13', 'glm_fed']);
    const b = buildTypeColorMap(['glm_fed', 'goes_band_13', 'radar_DBZH']);
    expect(a('goes_band_13')).toBe(b('goes_band_13'));
    expect(a('goes_band_13')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('assigns a distinct color per type even past the palette length', () => {
    const types = Array.from({ length: 25 }, (_, i) => `tipo_${i}`);
    const colorFor = buildTypeColorMap(types);
    expect(new Set(types.map(colorFor)).size).toBe(types.length);
  });

  it('is used by buildLineChart in place of typeColor', () => {
    const opts = buildLineChart(THROUGHPUT, 'count', 'count', undefined, () => '#123456');
    expect(opts.colors).toEqual(['#123456', '#123456']);
  });
});

describe('buildThroughputBarChart', () => {
  it('produces a stacked bar with one series per job type', () => {
    const opts = buildThroughputBarChart(THROUGHPUT);
    expect(opts.chart.type).toBe('bar');
    expect(opts.chart.stacked).toBe(true);
    expect(opts.series.map((s) => s.name)).toEqual(['a', 'b']);
  });
});

describe('buildLineChart', () => {
  it('produces a line chart with categories per bucket', () => {
    const opts = buildLineChart(THROUGHPUT, 'count', 'count');
    expect(opts.chart.type).toBe('line');
    expect(opts.chart.stacked).toBe(false);
    expect(opts.xaxis.categories).toHaveLength(2);
    expect(opts.series).toHaveLength(2);
  });
});

describe('buildStagePieChart', () => {
  const STAGES = { georef: 3, tiling: 4, upload: 2 };

  it('renders a donut with one slice per stage (Spanish labels, no descarga when off)', () => {
    const opts = buildStagePieChart(STAGES, 1.5, false);
    expect(opts.chart.type).toBe('donut');
    expect(opts.labels).toEqual(['Georref.', 'Teselado', 'Subida']);
    expect(opts.series).toEqual([3, 4, 2]);
    expect(opts.labels).not.toContain('Descarga');
  });

  it('appends a "Descarga" slice with the network seconds when includeRed and networkSecs > 0', () => {
    const opts = buildStagePieChart(STAGES, 1.5, true);
    expect(opts.labels.at(-1)).toBe('Descarga');
    expect(opts.series.at(-1)).toBe(1.5);
    expect(opts.colors).toHaveLength(opts.series.length);
  });

  it('omits the descarga slice when networkSecs is null or zero', () => {
    expect(buildStagePieChart(STAGES, null, true).labels).not.toContain('Descarga');
    expect(buildStagePieChart(STAGES, 0, true).labels).not.toContain('Descarga');
  });
});

describe('buildStageAreaChart', () => {
  const series: TimingSeriesPoint[] = [
    {
      bucket: 'b1',
      job_type: 'a',
      count: 1,
      avg_total_s: 10,
      p95_total_s: 12,
      stages: { georef: 3, tiling: 4 },
    },
    {
      bucket: 'b1',
      job_type: 'b',
      count: 1,
      avg_total_s: 5,
      p95_total_s: 6,
      stages: { upload: 2 },
    },
  ];

  it('filters to the chosen type and emits one stacked area per stage (Spanish labels)', () => {
    const opts = buildStageAreaChart(series, 'a');
    expect(opts.chart.type).toBe('area');
    expect(opts.chart.stacked).toBe(true);
    expect(opts.series.map((s) => s.name)).toEqual(['Georref.', 'Teselado']);
  });
});
