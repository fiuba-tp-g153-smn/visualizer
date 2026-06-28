import { describe, it, expect } from 'vitest';

import { axisTickFormatter, niceAxis } from './chart-axis.utils';

describe('niceAxis', () => {
  it('returns undefined for empty data so the axis stays auto-scaled', () => {
    expect(niceAxis([], { minStep: 1 })).toBeUndefined();
  });

  it('snaps a whole-number axis to round step boundaries', () => {
    // Temp 8..22 -> step 5 -> 5..25, every tick a whole number.
    const axis = niceAxis([8, 22, 14], { minStep: 1 })!;
    expect(axis.min).toBe(5);
    expect(axis.max).toBe(25);
    expect(axis.step).toBe(5);
    expect(axis.min).toBeLessThan(8);
    expect(axis.max).toBeGreaterThanOrEqual(22);
    expect(Number.isInteger(axis.step)).toBe(true);
  });

  it('keeps every tick a whole number for humidity', () => {
    const axis = niceAxis([52, 93, 65], { minStep: 1 })!;
    const ticks = Array.from({ length: axis.tickAmount + 1 }, (_, i) => axis.min + i * axis.step);
    expect(ticks.every((t) => Number.isInteger(t))).toBe(true);
    expect(axis.min).toBeLessThanOrEqual(52);
    expect(axis.max).toBeGreaterThanOrEqual(93);
  });

  it('floors visibility at zero', () => {
    const axis = niceAxis([5.6, 10.4, 8.8], { minStep: 1, floorAtZero: true })!;
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(10.4);
    expect(Number.isInteger(axis.step)).toBe(true);
  });

  it('uses 0.5-granularity steps for wind in knots', () => {
    // 0.67..7.15 kt -> step 2.5 -> 0 / 2.5 / 5 / 7.5.
    const axis = niceAxis([0.67, 7.15, 3.91], { minStep: 0.5 })!;
    const ticks = Array.from({ length: axis.tickAmount + 1 }, (_, i) => axis.min + i * axis.step);
    expect(ticks.every((t) => Number.isInteger(t * 2))).toBe(true); // multiples of 0.5
    expect(axis.min).toBeLessThanOrEqual(0.67);
    expect(axis.max).toBeGreaterThanOrEqual(7.15);
  });

  it('opens a band around flat data instead of a zero-height axis', () => {
    const axis = niceAxis([1013, 1013, 1013], { minStep: 1 })!;
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(axis.min).toBeLessThanOrEqual(1013);
    expect(axis.max).toBeGreaterThanOrEqual(1013);
  });

  it('handles a single data point', () => {
    const axis = niceAxis([10], { minStep: 1, floorAtZero: true })!;
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(10);
    expect(axis.tickAmount).toBeGreaterThanOrEqual(1);
  });

  it('snaps large offset ranges (Kelvin) to whole numbers', () => {
    const axis = niceAxis([281.3, 290.7], { minStep: 1 })!;
    expect(Number.isInteger(axis.min)).toBe(true);
    expect(Number.isInteger(axis.max)).toBe(true);
    expect(axis.min).toBeLessThanOrEqual(281.3);
    expect(axis.max).toBeGreaterThanOrEqual(290.7);
  });

  it('keeps tickAmount and step consistent with the bounds', () => {
    const axis = niceAxis([52, 93, 65], { minStep: 1 })!;
    expect(axis.min + axis.tickAmount * axis.step).toBeCloseTo(axis.max, 6);
  });
});

describe('axisTickFormatter', () => {
  it('renders whole-number steps without decimals', () => {
    const fmt = axisTickFormatter(2);
    expect(fmt(0)).toBe('0');
    expect(fmt(8)).toBe('8');
  });

  it('trims a trailing .0 but keeps .5 on a half-step axis', () => {
    const fmt = axisTickFormatter(2.5);
    expect(fmt(0)).toBe('0');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(5)).toBe('5');
    expect(fmt(7.5)).toBe('7.5');
  });

  it('re-snaps drifted tick positions before formatting', () => {
    const fmt = axisTickFormatter(2);
    expect(fmt(7.999999999)).toBe('8');
  });

  it('returns an empty string for nullish ticks', () => {
    const fmt = axisTickFormatter(1);
    expect(fmt(null as unknown as number)).toBe('');
    expect(fmt(Number.NaN)).toBe('');
  });
});
