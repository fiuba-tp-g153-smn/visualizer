import { describe, it, expect } from 'vitest';

import type { RecentJob } from '../../models/metrics/metrics.models';
import { outcomeColor } from './metrics-labels.constants';
import { colorOf, legendItems, packIntoLanes } from './timeline-shared.util';

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

describe('packIntoLanes', () => {
  it('keeps non-overlapping jobs in one lane and overlapping jobs in two', () => {
    const seq = packIntoLanes([
      job({ id: 1, started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:01:00Z' }),
      job({ id: 2, started_at: '2026-06-04T00:02:00Z', finished_at: '2026-06-04T00:03:00Z' }),
    ]);
    expect(seq.lanes).toBe(1);

    const overlap = packIntoLanes([
      job({ id: 1, started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:02:00Z' }),
      job({ id: 2, started_at: '2026-06-04T00:01:00Z', finished_at: '2026-06-04T00:03:00Z' }),
    ]);
    expect(overlap.lanes).toBe(2);
  });

  it('reuses a freed lane (rows = peak concurrency, not count) and ignores worker_host', () => {
    const { lanes } = packIntoLanes([
      job({ id: 1, worker_host: 'w1', started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:02:00Z' }),
      job({ id: 2, worker_host: 'w1', started_at: '2026-06-04T00:01:00Z', finished_at: '2026-06-04T00:03:00Z' }),
      job({ id: 3, worker_host: 'w2', started_at: '2026-06-04T00:04:00Z', finished_at: '2026-06-04T00:05:00Z' }),
    ]);
    expect(lanes).toBe(2); // not 3 — same-worker overlap split, then lane reused
  });

  it('orders rows by start and carries job/lane/start/end', () => {
    const { rows } = packIntoLanes([
      job({ id: 1, started_at: '2026-06-04T00:05:00Z', finished_at: '2026-06-04T00:05:30Z' }),
      job({ id: 2, started_at: '2026-06-04T00:01:00Z', finished_at: '2026-06-04T00:01:30Z' }),
    ]);
    expect(rows.map((r) => r.job.id)).toEqual([2, 1]);
    expect(rows[0].start).toBe(Date.parse('2026-06-04T00:01:00Z'));
    expect(rows[0].end).toBe(Date.parse('2026-06-04T00:01:30Z'));
    expect(rows[0].lane).toBe(0);
  });

  it('returns zero lanes for no jobs', () => {
    expect(packIntoLanes([]).lanes).toBe(0);
    expect(packIntoLanes([]).rows).toEqual([]);
  });
});

describe('colorOf', () => {
  it('uses the outcome palette or the type color map', () => {
    const typeColorFor = (t: string) => (t === 'a' ? '#111111' : '#222222');
    expect(colorOf(job({ outcome: 'dlq' }), 'outcome', typeColorFor)).toBe(outcomeColor('dlq'));
    expect(colorOf(job({ job_type: 'a' }), 'type', typeColorFor)).toBe('#111111');
  });
});

describe('legendItems', () => {
  it('lists present outcomes in a fixed order with their colors', () => {
    const items = legendItems(
      [job({ id: 1, outcome: 'error' }), job({ id: 2, outcome: 'success' })],
      'outcome',
    );
    expect(items.map((i) => i.label)).toEqual(['Éxito', 'Error']); // success before error
    expect(items.find((i) => i.label === 'Error')?.color).toBe(outcomeColor('error'));
  });

  it('lists one entry per job type when colorBy=type', () => {
    const items = legendItems(
      [job({ id: 1, job_type: 'a' }), job({ id: 2, job_type: 'a' }), job({ id: 3, job_type: 'b' })],
      'type',
    );
    expect(items).toHaveLength(2);
  });
});
