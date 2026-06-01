import { describe, it, expect } from 'vitest';

import { decomposeBarb, windBarbSvg } from './wind-barb.util';

const OPTS = { size: 40, color: '#3a86ff' };
const lines = (svg: string) => svg.split('<line').length - 1;
const paths = (svg: string) => svg.split('<path').length - 1;

describe('decomposeBarb', () => {
  it('splits speed (rounded to 5 kt) into pennants / fulls / halves', () => {
    expect(decomposeBarb(5)).toEqual({ pennants: 0, fulls: 0, halves: 1 });
    expect(decomposeBarb(10)).toEqual({ pennants: 0, fulls: 1, halves: 0 });
    expect(decomposeBarb(25)).toEqual({ pennants: 0, fulls: 2, halves: 1 });
    expect(decomposeBarb(50)).toEqual({ pennants: 1, fulls: 0, halves: 0 });
    expect(decomposeBarb(75)).toEqual({ pennants: 1, fulls: 2, halves: 1 });
    expect(decomposeBarb(7)).toEqual({ pennants: 0, fulls: 0, halves: 1 }); // 7 → rounds to 5 kt
    expect(decomposeBarb(8)).toEqual({ pennants: 0, fulls: 1, halves: 0 }); // 8 → rounds to 10 kt
  });
});

describe('windBarbSvg', () => {
  it('renders an open circle (no staff) for calm', () => {
    const svg = windBarbSvg(0, 90, OPTS);
    expect(svg).toContain('<circle');
    expect(lines(svg)).toBe(0);
  });

  it('renders an open circle when the bearing is unknown, even with speed', () => {
    const svg = windBarbSvg(20, null, OPTS);
    expect(svg).toContain('<circle');
    expect(lines(svg)).toBe(0);
  });

  it('draws staff + one half barb for 5 kt', () => {
    const svg = windBarbSvg(5, 90, OPTS);
    expect(lines(svg)).toBe(2); // staff + half
    expect(paths(svg)).toBe(0);
  });

  it('draws staff + one full barb for 10 kt', () => {
    expect(lines(windBarbSvg(10, 90, OPTS))).toBe(2); // staff + 1 full
  });

  it('draws staff + two full + one half for 25 kt', () => {
    expect(lines(windBarbSvg(25, 90, OPTS))).toBe(4); // staff + 2 full + 1 half
  });

  it('draws a pennant (path) for 50 kt', () => {
    const svg = windBarbSvg(50, 90, OPTS);
    expect(paths(svg)).toBe(1); // one pennant
    expect(lines(svg)).toBe(1); // just the staff
  });

  it('rotates the glyph to the bearing', () => {
    expect(windBarbSvg(20, 135, OPTS)).toContain('rotate(135');
  });
});
