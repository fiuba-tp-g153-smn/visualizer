import { describe, it, expect } from 'vitest';

import type { DataSyncHistoryPoint } from '../../models/metrics/data-metrics.models';
import { buildSyncTp10Chart } from './data-metrics-chart.util';

function point(over: Partial<DataSyncHistoryPoint>): DataSyncHistoryPoint {
  return {
    bucket: '2026-06-17T10:0',
    domain: 'satellite',
    cycles: 1,
    downloaded: 0,
    errors: 0,
    avg_duration_ms: 0,
    ...over,
  };
}

describe('buildSyncTp10Chart', () => {
  it('total mode aggregates downloaded across domains into a single series', () => {
    const rows = [
      point({ bucket: '2026-06-17T10:0', domain: 'satellite', downloaded: 3 }),
      point({ bucket: '2026-06-17T10:0', domain: 'radar', downloaded: 2 }),
      point({ bucket: '2026-06-17T10:1', domain: 'satellite', downloaded: 4 }),
    ];
    const opts = buildSyncTp10Chart(rows, 'total', true);
    const series = opts.series as ReadonlyArray<{ name: string; data: number[] }>;

    expect(series).toHaveLength(1);
    expect(series[0].name).toBe('Total');
    // buckets sorted: 10:0 → 3 + 2 = 5, 10:1 → 4
    expect(series[0].data).toEqual([5, 4]);
  });

  it('byType mode emits one series per domain', () => {
    const rows = [
      point({ domain: 'satellite', downloaded: 3 }),
      point({ domain: 'radar', downloaded: 2 }),
    ];
    const opts = buildSyncTp10Chart(rows, 'byType', true);
    const names = (opts.series as ReadonlyArray<{ name: string }>).map((s) => s.name).sort();

    expect(names).toEqual(['radar', 'satellite']);
  });
});
