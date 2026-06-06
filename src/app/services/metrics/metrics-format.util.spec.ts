import { describe, it, expect } from 'vitest';

import { ago, fmtBucket, pct, secs } from './metrics-format.util';

describe('secs', () => {
  it('returns an em dash for null/undefined', () => {
    expect(secs(null)).toBe('—');
    expect(secs(undefined)).toBe('—');
  });

  it('uses 2 decimals under 10 s and 1 decimal at or above', () => {
    expect(secs(5)).toBe('5.00s');
    expect(secs(3.2)).toBe('3.20s');
    expect(secs(12.34)).toBe('12.3s');
  });
});

describe('pct', () => {
  it('formats a [0,1] fraction as a percentage', () => {
    expect(pct(0.5)).toBe('50.0%');
    expect(pct(0.12345)).toBe('12.3%');
  });

  it('returns an em dash for null', () => {
    expect(pct(null)).toBe('—');
  });
});

describe('ago', () => {
  const now = Date.parse('2026-06-04T01:00:00Z');

  it('formats seconds / minutes / hours / days in Spanish', () => {
    expect(ago('2026-06-04T00:59:30Z', now)).toBe('hace 30s');
    expect(ago('2026-06-04T00:30:00Z', now)).toBe('hace 30m');
    expect(ago('2026-06-03T23:00:00Z', now)).toBe('hace 2h');
    expect(ago('2026-06-02T01:00:00Z', now)).toBe('hace 2d');
  });

  it('returns an em dash for empty/invalid input', () => {
    expect(ago(null, now)).toBe('—');
    expect(ago('not-a-date', now)).toBe('—');
  });
});

describe('fmtBucket', () => {
  it('renders a 10-minute bucket (15 chars) as "MM-DD HH:M0"', () => {
    expect(fmtBucket('2026-06-04T00:3')).toBe('06-04 00:30');
  });

  it('renders an hour bucket (13 chars) as "MM-DD HHh"', () => {
    expect(fmtBucket('2026-06-04T00')).toBe('06-04 00h');
  });

  it('renders a day bucket (10 chars) as "MM-DD"', () => {
    expect(fmtBucket('2026-06-04')).toBe('06-04');
  });
});
