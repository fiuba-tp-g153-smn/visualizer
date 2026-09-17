import { describe, it, expect } from 'vitest';

import type { ThroughputBucket, TimingSeriesPoint } from '../../models/metrics/metrics.models';
import {
  buildLineChart,
  buildStageAreaChart,
  buildStagePieChart,
  buildThroughputBarChart,
  buildTotalThroughputChart,
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
    expect(typeColor('radar_sinarame_dbzh')).toBe(typeColor('radar_sinarame_dbzh'));
    expect(typeColor('radar_sinarame_dbzh')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('buildTypeColorMap', () => {
  it('gives a type the same color regardless of input order (stable)', () => {
    const a = buildTypeColorMap(['radar_sinarame_dbzh', 'goes19_abi_c13', 'goes19_glm_fed']);
    const b = buildTypeColorMap(['goes19_glm_fed', 'goes19_abi_c13', 'radar_sinarame_dbzh']);
    expect(a('goes19_abi_c13')).toBe(b('goes19_abi_c13'));
    expect(a('goes19_abi_c13')).toMatch(/^#[0-9a-f]{6}$/i);
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

describe('huecos sin datos', () => {
  // 06:00 y 06:10 con datos, 06:20 y 06:30 caídos, 06:40 de vuelta.
  const OUTAGE: ThroughputBucket[] = [
    { bucket: '2026-09-17T06:0', job_type: 'a', count: 12 },
    { bucket: '2026-09-17T06:1', job_type: 'a', count: 10 },
    { bucket: '2026-09-17T06:1', job_type: 'b', count: 4 },
    { bucket: '2026-09-17T06:4', job_type: 'a', count: 9 },
  ];

  it('pivot reinserta los intervalos faltantes y los marca sin datos', () => {
    const p = pivot(OUTAGE, 'count');

    expect(p.buckets).toEqual([
      '2026-09-17T06:0',
      '2026-09-17T06:1',
      '2026-09-17T06:2',
      '2026-09-17T06:3',
      '2026-09-17T06:4',
    ]);
    expect(p.hasData('2026-09-17T06:1')).toBe(true);
    expect(p.hasData('2026-09-17T06:2')).toBe(false);
  });

  it('buildTotalThroughputChart corta la línea total sobre el hueco', () => {
    const opts = buildTotalThroughputChart(OUTAGE);
    const [total] = opts.series as ReadonlyArray<{ data: Array<number | null> }>;

    expect(total.data).toEqual([12, 14, null, null, 9]);
    expect(opts.xaxis.categories).toHaveLength(5);
  });

  it('buildLineChart corta cada tipo sobre el hueco, pero cuenta 0 donde sí hubo datos', () => {
    const opts = buildLineChart(OUTAGE, 'count', 'count');
    const series = opts.series as ReadonlyArray<{ name: string; data: Array<number | null> }>;

    expect(series.find((s) => s.name === 'a')?.data).toEqual([12, 10, null, null, 9]);
    // 'b' sólo aparece en 06:10: en 06:00 y 06:40 hubo trabajos (0 de ese tipo),
    // en 06:20 y 06:30 no hubo nada (hueco).
    expect(series.find((s) => s.name === 'b')?.data).toEqual([0, 4, null, null, 0]);
  });

  it('buildThroughputBarChart deja el hueco sin columna en vez de dibujar un 0', () => {
    const opts = buildThroughputBarChart(OUTAGE);
    const series = opts.series as ReadonlyArray<{ name: string; data: Array<number | null> }>;

    expect(series.find((s) => s.name === 'a')?.data).toEqual([12, 10, null, null, 9]);
  });

  it('el tooltip del hueco dice "Sin datos" en vez de un total de 0', () => {
    const opts = buildLineChart(OUTAGE, 'count', 'count');
    const series = (opts.series as ReadonlyArray<{ data: Array<number | null> }>).map(
      (s) => s.data,
    );
    const render = opts.tooltip.custom as (context: unknown) => string;
    const context = (dataPointIndex: number) => ({
      series,
      dataPointIndex,
      w: { globals: { seriesNames: ['a', 'b'], colors: ['#111', '#222'], labels: [] } },
    });

    expect(render(context(2))).toContain('Sin datos');
    expect(render(context(2))).not.toContain('Total');
    expect(render(context(1))).toContain('Total');
  });

  it('buildStageAreaChart corta el área apilada sobre el hueco', () => {
    const rows: TimingSeriesPoint[] = [
      {
        bucket: '2026-09-17T06',
        job_type: 'a',
        count: 1,
        avg_total_s: 10,
        p95_total_s: 12,
        stages: { georef: 3, tiling: 4 },
      },
      {
        bucket: '2026-09-17T09',
        job_type: 'a',
        count: 1,
        avg_total_s: 11,
        p95_total_s: 13,
        stages: { georef: 2, tiling: 5 },
      },
    ];
    const opts = buildStageAreaChart(rows, 'a');
    const series = opts.series as ReadonlyArray<{ name: string; data: Array<number | null> }>;

    expect(series[0].data).toEqual([3, null, null, 2]);
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

  it('labels the ECMWF producer "list" stage "Verif. existentes" with its own color', () => {
    const opts = buildStagePieChart({ upload: 0.8, list: 4.1 }, null, false);
    expect(opts.labels).toEqual(['Subida', 'Verif. existentes']);
    expect(opts.colors[opts.labels.indexOf('Verif. existentes')]).toBe('#5b6bbd');
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
