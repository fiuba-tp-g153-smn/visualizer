import { describe, it, expect } from 'vitest';

import type { RecentJob } from '../../models/metrics/metrics.models';
import { buildEchartsOption, type EchartsTimelineDatum } from './echarts-timeline.util';
import { outcomeColor } from './metrics-labels.constants';

function job(over: Partial<RecentJob>): RecentJob {
  return {
    id: 1,
    work_unit_id: 'wu',
    image_id: 'img',
    data_source_id: 'goes19_abi_band_13',
    processor_id: 'goes_band_13',
    band_id: 'band_13',
    job_type: 'goes19_abi_band_13',
    product_label: 'GOES ABI band_13',
    image_timestamp: null,
    outcome: 'success',
    worker_host: 'worker1',
    started_at: '2026-06-04T00:00:00Z',
    finished_at: '2026-06-04T00:00:30Z',
    retry_count: 0,
    error_message: null,
    download_s: 1,
    process_s: 20,
    total_s: 30,
    stage_timings: {},
    ...over,
  };
}

const data = (o: ReturnType<typeof buildEchartsOption>): EchartsTimelineDatum[] =>
  o.option.series[0]['data'] as EchartsTimelineDatum[];

describe('buildEchartsOption', () => {
  it('emits one datum per job with value [lane, startMs, endMs]', () => {
    const o = buildEchartsOption(
      [job({ id: 1, started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:01:00Z' })],
      { utc: true, colorBy: 'outcome' },
    );
    expect(data(o)).toHaveLength(1);
    expect(data(o)[0].value).toEqual([
      0,
      Date.parse('2026-06-04T00:00:00Z'),
      Date.parse('2026-06-04T00:01:00Z'),
    ]);
    expect(o.lanes).toBe(1);
  });

  it('packs overlapping jobs onto separate lanes (peak concurrency) for legacy data', () => {
    // worker_host: null → no clean worker name → overlap layout (as before).
    const o = buildEchartsOption(
      [
        job({ id: 1, worker_host: null, started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:02:00Z' }),
        job({ id: 2, worker_host: null, started_at: '2026-06-04T00:01:00Z', finished_at: '2026-06-04T00:03:00Z' }),
      ],
      { utc: true, colorBy: 'outcome' },
    );
    expect(o.lanes).toBe(2);
    expect(new Set(data(o).map((d) => d.value[0]))).toEqual(new Set([0, 1]));
    expect((o.option.yAxis as { show: boolean }).show).toBe(false);
  });

  it('groups overlapping jobs into one lane per worker container, with named axis', () => {
    // Two overlapping jobs on the same worker → a single lane (not two), and the
    // y-axis shows the worker names.
    const o = buildEchartsOption(
      [
        job({ id: 1, worker_host: 'worker1', started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:02:00Z' }),
        job({ id: 2, worker_host: 'worker1', started_at: '2026-06-04T00:01:00Z', finished_at: '2026-06-04T00:03:00Z' }),
        job({ id: 3, worker_host: 'worker-light1', started_at: '2026-06-04T00:00:30Z', finished_at: '2026-06-04T00:01:30Z' }),
      ],
      { utc: true, colorBy: 'outcome' },
    );
    expect(o.lanes).toBe(2); // worker1, worker-light1 — not 3 (overlap would split)
    const yAxis = o.option.yAxis as { show: boolean; data: string[] };
    expect(yAxis.show).toBe(true);
    expect(yAxis.data).toEqual(['worker1', 'worker-light1']); // general before light
    // worker1's two jobs share lane 0; the light worker is lane 1.
    const laneById = new Map(data(o).map((d) => [d.job.id, d.value[0]]));
    expect(laneById.get(1)).toBe(0);
    expect(laneById.get(2)).toBe(0);
    expect(laneById.get(3)).toBe(1);
  });

  it('draws each bar with a thin separator stroke so dense bars stay distinct', () => {
    const o = buildEchartsOption([job({})], { utc: true, colorBy: 'outcome' });
    const renderItem = o.option.series[0]['renderItem'] as (
      p: { dataIndex: number },
      api: {
        value: (d: number) => number;
        coord: (pt: [number, number]) => [number, number];
        size: () => [number, number];
      },
    ) => { type: string; style: { fill: string; stroke: string; lineWidth: number } };
    const api = {
      value: (dim: number) => [0, 1000, 2000][dim],
      coord: ([x]: [number, number]): [number, number] => [x / 10, 50],
      size: (): [number, number] => [0, 20],
    };
    const rect = renderItem({ dataIndex: 0 }, api);
    expect(rect.type).toBe('rect');
    expect(rect.style.fill).toBe(data(o)[0].color);
    expect(rect.style.stroke).toBe('#ffffff');
    expect(rect.style.lineWidth).toBe(1);
  });

  it('colors by outcome and by type', () => {
    const byOutcome = buildEchartsOption([job({ outcome: 'dlq' })], { utc: true, colorBy: 'outcome' });
    expect(data(byOutcome)[0].color).toBe(outcomeColor('dlq'));

    const byType = buildEchartsOption(
      [job({ id: 1, job_type: 'a' }), job({ id: 2, job_type: 'a' }), job({ id: 3, job_type: 'b' })],
      { utc: true, colorBy: 'type' },
    );
    const colors = new Map(data(byType).map((d) => [d.job.id, d.color]));
    expect(colors.get(1)).toBe(colors.get(2));
    expect(colors.get(1)).not.toBe(colors.get(3));
  });

  it('configures a time axis and dataZoom with weakFilter', () => {
    const o = buildEchartsOption([job({})], { utc: true, colorBy: 'outcome' });
    expect((o.option.xAxis as { type: string }).type).toBe('time');
    expect(o.option.dataZoom).toHaveLength(2);
    expect(o.option.dataZoom.every((dz) => dz['filterMode'] === 'weakFilter')).toBe(true);
  });

  it('shows persistent datetime labels on the slider handles', () => {
    const o = buildEchartsOption([job({})], { utc: true, colorBy: 'outcome' });
    const slider = o.option.dataZoom[1] as Record<string, unknown>;
    expect((slider['handleLabel'] as { show: boolean }).show).toBe(true);
    expect(typeof slider['labelFormatter']).toBe('function');
  });

  it('formats day-boundary axis ticks as bold DD/MM', () => {
    const o = buildEchartsOption([job({})], { utc: true, colorBy: 'outcome' });
    const axisLabel = (
      o.option.xAxis as {
        axisLabel: { formatter: Record<string, string>; rich: Record<string, unknown> };
      }
    ).axisLabel;
    expect(axisLabel.formatter['day']).toBe('{boldDate|{dd}/{MM}}');
    expect(axisLabel.rich['boldDate']).toBeDefined();
  });

  it('reflects the utc flag via useUTC', () => {
    expect(buildEchartsOption([job({})], { utc: true, colorBy: 'outcome' }).option.useUTC).toBe(true);
    expect(buildEchartsOption([job({})], { utc: false, colorBy: 'outcome' }).option.useUTC).toBe(
      false,
    );
  });

  it('returns an empty series and zero lanes for no jobs', () => {
    const o = buildEchartsOption([], { utc: true, colorBy: 'outcome' });
    expect(data(o)).toHaveLength(0);
    expect(o.lanes).toBe(0);
  });

  it('reports the data extent [minStart, maxEnd]', () => {
    const o = buildEchartsOption(
      [
        job({ id: 1, started_at: '2026-06-01T00:00:00Z', finished_at: '2026-06-01T00:01:00Z' }),
        job({ id: 2, started_at: '2026-06-10T00:00:00Z', finished_at: '2026-06-10T00:02:00Z' }),
      ],
      { utc: true, colorBy: 'outcome' },
    );
    expect(o.extent).toEqual([
      Date.parse('2026-06-01T00:00:00Z'),
      Date.parse('2026-06-10T00:02:00Z'),
    ]);
  });

  it('caps the view to maxSpanMs and starts at the most recent span', () => {
    const week = 7 * 24 * 3600 * 1000;
    const o = buildEchartsOption(
      [
        job({ id: 1, started_at: '2026-06-01T00:00:00Z', finished_at: '2026-06-01T00:01:00Z' }),
        job({ id: 2, started_at: '2026-06-10T00:00:00Z', finished_at: '2026-06-10T00:01:00Z' }),
      ],
      { utc: true, colorBy: 'outcome', maxSpanMs: week },
    );
    const end = Date.parse('2026-06-10T00:01:00Z');
    const inside = o.option.dataZoom[0] as Record<string, number>;
    expect(inside['maxValueSpan']).toBe(week);
    expect(inside['endValue']).toBe(end);
    expect(inside['startValue']).toBe(end - week);
  });

  it('omits maxValueSpan / window bounds when maxSpanMs is not set', () => {
    const inside = buildEchartsOption([job({})], { utc: true, colorBy: 'outcome' }).option
      .dataZoom[0] as Record<string, unknown>;
    expect(inside['maxValueSpan']).toBeUndefined();
    expect(inside['startValue']).toBeUndefined();
  });
});
