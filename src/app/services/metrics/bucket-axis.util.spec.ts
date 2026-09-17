import { describe, expect, it } from 'vitest';

import { denseBucketAxis, parseBucket } from './bucket-axis.util';

describe('parseBucket', () => {
  it('reads the API bucket prefixes as UTC instants', () => {
    expect(parseBucket('2026-09-17')).toBe(Date.UTC(2026, 8, 17));
    expect(parseBucket('2026-09-17T06')).toBe(Date.UTC(2026, 8, 17, 6));
    expect(parseBucket('2026-09-17T06:2')).toBe(Date.UTC(2026, 8, 17, 6, 20));
  });

  it('reads a raw sample timestamp, assuming UTC when it carries no zone', () => {
    expect(parseBucket('2026-09-17T06:20:00')).toBe(Date.UTC(2026, 8, 17, 6, 20));
    expect(parseBucket('2026-09-17T06:20:00Z')).toBe(Date.UTC(2026, 8, 17, 6, 20));
  });
});

describe('denseBucketAxis', () => {
  it('fills the 10-min slots the outage left out and flags them as gaps', () => {
    const axis = denseBucketAxis(['2026-09-17T05:5', '2026-09-17T06:0', '2026-09-17T06:3']);

    expect(axis.buckets).toEqual([
      '2026-09-17T05:5',
      '2026-09-17T06:0',
      '2026-09-17T06:1',
      '2026-09-17T06:2',
      '2026-09-17T06:3',
    ]);
    expect(axis.has('2026-09-17T06:0')).toBe(true);
    expect(axis.has('2026-09-17T06:1')).toBe(false);
    expect(axis.has('2026-09-17T06:2')).toBe(false);
  });

  it('fills hour and day grids the same way', () => {
    expect(denseBucketAxis(['2026-09-17T06', '2026-09-17T09']).buckets).toEqual([
      '2026-09-17T06',
      '2026-09-17T07',
      '2026-09-17T08',
      '2026-09-17T09',
    ]);
    expect(denseBucketAxis(['2026-09-15', '2026-09-17']).buckets).toEqual([
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ]);
  });

  it('leaves a contiguous run untouched', () => {
    const buckets = ['2026-09-17T06:0', '2026-09-17T06:1', '2026-09-17T06:2'];
    const axis = denseBucketAxis(buckets);

    expect(axis.buckets).toEqual(buckets);
    expect(buckets.every(axis.has)).toBe(true);
  });

  it('opens a huge gap with a single slot instead of thousands', () => {
    const axis = denseBucketAxis(['2020-01-01T00:0', '2026-09-17T06:0']);

    expect(axis.buckets).toEqual(['2020-01-01T00:0', '2020-01-01T00:1', '2026-09-17T06:0']);
    expect(axis.has('2020-01-01T00:1')).toBe(false);
  });

  it('breaks an irregularly sampled series only where the jump exceeds its cadence', () => {
    // Muestras cada ~5 min (con jitter) y un salto de 2 h en el medio.
    const axis = denseBucketAxis([
      '2026-09-17T06:00:00',
      '2026-09-17T06:05:12',
      '2026-09-17T06:09:48',
      '2026-09-17T08:10:00',
    ]);

    expect(axis.buckets).toHaveLength(5);
    expect(axis.buckets[3]).toBe('2026-09-17T07:09:54.000Z'); // slot sintético
    expect(axis.has(axis.buckets[3])).toBe(false);
    expect(axis.buckets.filter((bucket) => !axis.has(bucket))).toHaveLength(1);
  });

  it('returns the buckets untouched when they are not recognisable dates', () => {
    const axis = denseBucketAxis(['b2', 'b1']);

    expect(axis.buckets).toEqual(['b1', 'b2']);
    expect(axis.has('b1')).toBe(true);
  });
});
