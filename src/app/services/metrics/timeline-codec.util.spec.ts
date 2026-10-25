import { describe, it, expect } from 'vitest';

import type { TimelinePayload } from '../../models/metrics/metrics.models';
import { decodeTimeline } from './timeline-codec.util';

const T0 = Date.parse('2026-06-04T00:00:00Z');

/** Tres trabajos: ids 10..12, inicios 0s/1s/5.25s, uno sin worker. */
const PAYLOAD: TimelinePayload = {
  v: 1,
  t0: T0,
  types: ['goes19_abi_c13', 'radar_sinarame_dbzh'],
  labels: ['GOES-19 ABI c13', null],
  outcomes: ['success', 'dlq'],
  workers: ['worker1', null],
  id: [10, 1, 1],
  type: [0, 1, 1],
  outcome: [0, 1, 0],
  worker: [0, 1, 0],
  start: [0, 1000, 4250],
  dur: [44500, 2000, 3750],
};

describe('decodeTimeline', () => {
  it('reconstruye ids e instantes desde las diferencias', () => {
    const jobs = decodeTimeline(PAYLOAD);

    expect(jobs.map((j) => j.id)).toEqual([10, 11, 12]);
    expect(jobs.map((j) => j.started_at)).toEqual([
      '2026-06-04T00:00:00.000Z',
      '2026-06-04T00:00:01.000Z',
      '2026-06-04T00:00:05.250Z',
    ]);
    expect(jobs[0].finished_at).toBe('2026-06-04T00:00:44.500Z');
  });

  it('resuelve los diccionarios y deriva total_s de la duración', () => {
    const [first, second] = decodeTimeline(PAYLOAD);

    expect(first).toMatchObject({
      job_type: 'goes19_abi_c13',
      product_label: 'GOES-19 ABI c13',
      outcome: 'success',
      worker_host: 'worker1',
      total_s: 44.5,
    });
    expect(second).toMatchObject({
      job_type: 'radar_sinarame_dbzh',
      product_label: null,
      outcome: 'dlq',
      worker_host: null,
      total_s: 2,
    });
  });

  it('deja en valores neutros los campos que la línea de tiempo no usa', () => {
    const [job] = decodeTimeline(PAYLOAD);

    expect(job.error_message).toBeNull();
    expect(job.stage_timings).toEqual({});
  });

  it('una ventana vacía decodifica a una lista vacía', () => {
    const empty: TimelinePayload = {
      ...PAYLOAD,
      t0: null,
      types: [],
      labels: [],
      outcomes: [],
      workers: [],
      id: [],
      type: [],
      outcome: [],
      worker: [],
      start: [],
      dur: [],
    };

    expect(decodeTimeline(empty)).toEqual([]);
  });
});
