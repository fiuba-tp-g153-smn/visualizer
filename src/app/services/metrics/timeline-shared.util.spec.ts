import { describe, it, expect } from 'vitest';

import type { RecentJob } from '../../models/metrics/metrics.models';
import { outcomeColor } from './metrics-labels.constants';
import {
  canGroupByWorker,
  colorOf,
  fmtDate,
  fmtDateTime,
  layoutTimeline,
  legendItems,
  packByWorker,
  packIntoLanes,
} from './timeline-shared.util';

const pad = (n: number): string => String(n).padStart(2, '0');

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

describe('canGroupByWorker', () => {
  it('is true only when every job has a clean worker container name', () => {
    expect(
      canGroupByWorker([job({ worker_host: 'worker1' }), job({ worker_host: 'worker-light2' })]),
    ).toBe(true);
    expect(canGroupByWorker([])).toBe(false);
    expect(canGroupByWorker([job({ worker_host: null })])).toBe(false);
    expect(canGroupByWorker([job({ worker_host: '3f2a1b9c4d5e' })])).toBe(false); // legacy hostname hash
    // Mixed: one legacy → whole set falls back.
    expect(
      canGroupByWorker([job({ worker_host: 'worker1' }), job({ worker_host: null })]),
    ).toBe(false);
  });
});

describe('packByWorker', () => {
  it('assigns one lane per worker, ordered general→light then by number', () => {
    const { lanes, laneLabels, rows } = packByWorker([
      job({ id: 1, worker_host: 'worker-light1' }),
      job({ id: 2, worker_host: 'worker2' }),
      job({ id: 3, worker_host: 'worker1' }),
      job({ id: 4, worker_host: 'worker2' }),
    ]);
    expect(lanes).toBe(3);
    expect(laneLabels).toEqual(['worker1', 'worker2', 'worker-light1']);
    const laneById = new Map(rows.map((r) => [r.job.id, r.lane]));
    expect(laneById.get(3)).toBe(0); // worker1
    expect(laneById.get(2)).toBe(1); // worker2
    expect(laneById.get(4)).toBe(1); // worker2 shares its lane
    expect(laneById.get(1)).toBe(2); // worker-light1 last
  });
});

describe('layoutTimeline', () => {
  it('groups by worker (named lanes) when all names are clean', () => {
    const layout = layoutTimeline([
      job({ worker_host: 'worker1' }),
      job({ worker_host: 'worker-light1' }),
    ]);
    expect(layout.grouped).toBe(true);
    expect(layout.laneLabels).toEqual(['worker1', 'worker-light1']);
  });

  it('falls back to overlap packing (numeric labels) for legacy/mixed data', () => {
    const layout = layoutTimeline([
      job({ id: 1, worker_host: null, started_at: '2026-06-04T00:00:00Z', finished_at: '2026-06-04T00:02:00Z' }),
      job({ id: 2, worker_host: 'worker1', started_at: '2026-06-04T00:01:00Z', finished_at: '2026-06-04T00:03:00Z' }),
    ]);
    expect(layout.grouped).toBe(false);
    expect(layout.lanes).toBe(2); // overlap
    expect(layout.laneLabels).toEqual(['1', '2']);
  });
});

describe('colorOf', () => {
  it('uses the outcome palette or the type color map', () => {
    const typeColorFor = (t: string) => (t === 'a' ? '#111111' : '#222222');
    expect(colorOf(job({ outcome: 'dlq' }), 'outcome', typeColorFor)).toBe(outcomeColor('dlq'));
    expect(colorOf(job({ job_type: 'a' }), 'type', typeColorFor)).toBe('#111111');
  });
});

describe('fmtDate / fmtDateTime', () => {
  const ms = Date.parse('2026-06-08T09:05:00Z');

  it('formats date as DD/MM and datetime as DD/MM HH:mm in UTC', () => {
    expect(fmtDate(ms, true)).toBe('08/06');
    expect(fmtDateTime(ms, true)).toBe('08/06 09:05');
  });

  it('formats in local time when utc=false (TZ-agnostic)', () => {
    const d = new Date(ms);
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(fmtDate(ms, false)).toBe(date);
    expect(fmtDateTime(ms, false)).toBe(`${date} ${time}`);
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
