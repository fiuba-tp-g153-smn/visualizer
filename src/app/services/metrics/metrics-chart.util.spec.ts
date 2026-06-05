import { describe, it, expect } from 'vitest';

import type { ThroughputBucket, TimingSeriesPoint } from '../../models/metrics/metrics.models';
import {
  buildLineChart,
  buildStageAreaChart,
  buildThroughputBarChart,
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
