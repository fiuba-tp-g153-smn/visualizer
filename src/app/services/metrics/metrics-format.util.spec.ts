import { describe, it, expect } from 'vitest';

import { ago, fmtBucket, fmtInstant, pct, secs } from './metrics-format.util';

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
  describe('UTC mode (utc=true)', () => {
    it('renders a 10-minute bucket (15 chars) as "MM-DD HH:M0"', () => {
      expect(fmtBucket('2026-06-04T00:3', true)).toBe('06-04 00:30');
    });

    it('renders an hour bucket (13 chars) as "MM-DD HHh"', () => {
      expect(fmtBucket('2026-06-04T00', true)).toBe('06-04 00h');
    });

    it('defaults to UTC, byte-identical to the previous slicing output', () => {
      expect(fmtBucket('2026-06-04T13')).toBe('06-04 13h');
      expect(fmtBucket('2026-06-04T13:4')).toBe('06-04 13:40');
    });
  });

  it('renders a day bucket (10 chars) as "MM-DD" in both modes (boundary is UTC)', () => {
    expect(fmtBucket('2026-06-04', true)).toBe('06-04');
    expect(fmtBucket('2026-06-04', false)).toBe('06-04');
  });

  describe('local mode (utc=false)', () => {
    // Runner-TZ agnostic: derive the expected label from the same instant using
    // the local getters, so this passes whether CI runs in UTC or in ART.
    const localLabel = (iso: string, withMinutes: boolean): string => {
      const d = new Date(iso);
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      if (!withMinutes) {
        return `${mo}-${dd} ${hh}h`;
      }
      return `${mo}-${dd} ${hh}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    it('formats an hour bucket in the browser local timezone', () => {
      expect(fmtBucket('2026-06-04T03', false)).toBe(localLabel('2026-06-04T03:00:00Z', false));
    });

    it('formats a 10-minute bucket in the browser local timezone', () => {
      expect(fmtBucket('2026-06-04T03:3', false)).toBe(localLabel('2026-06-04T03:30:00Z', true));
    });
  });
});

describe('fmtInstant', () => {
  it('returns an em dash for empty/invalid input', () => {
    expect(fmtInstant(null)).toBe('—');
    expect(fmtInstant(undefined)).toBe('—');
    expect(fmtInstant('not-a-date')).toBe('—');
  });

  it('formats a valid ISO instant into a non-empty localized string', () => {
    const out = fmtInstant('2026-06-04T21:00:44+00:00');
    expect(out).not.toBe('—');
    expect(out.length).toBeGreaterThan(0);
  });
});
