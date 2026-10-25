import { describe, it, expect } from 'vitest';

import {
  GraticuleAxis,
  GraticuleLine,
  buildGraticuleLines,
  meridianCopies,
  visibleGraticuleLabels,
} from './graticule.utils';

const lines = buildGraticuleLines();

function find(axis: GraticuleAxis, value: number): ReadonlyArray<GraticuleLine> {
  return lines.filter((l) => l.axis === axis && l.value === value);
}

describe('buildGraticuleLines', () => {
  it('draws parallels every 5° within the Web Mercator limit', () => {
    const values = lines.filter((l) => l.axis === 'parallel' && l.tier !== 'notable');
    expect(values.map((l) => l.value)).toContain(-85);
    expect(values.map((l) => l.value)).toContain(85);
    expect(find('parallel', 90)).toHaveLength(0);
    // -85..85 step 5 is 35 lines, minus the Ecuador drawn as notable.
    expect(values).toHaveLength(34);
  });

  it('draws meridians every 5° without duplicating the antimeridian', () => {
    const values = lines.filter((l) => l.axis === 'meridian' && l.tier !== 'notable');
    expect(find('meridian', -180)).toHaveLength(1);
    expect(find('meridian', 180)).toHaveLength(0);
    // 72 meridians, minus Greenwich drawn as notable.
    expect(values).toHaveLength(71);
  });

  it('marks multiples of 10° as major and the rest as minor', () => {
    expect(find('parallel', -30)[0].tier).toBe('major');
    expect(find('parallel', -35)[0].tier).toBe('minor');
    expect(find('meridian', -60)[0].tier).toBe('major');
    expect(find('meridian', -65)[0].tier).toBe('minor');
  });

  it('keeps the notable lines, with a single line where they overlap the grid', () => {
    expect(find('parallel', 0)).toEqual([
      { axis: 'parallel', value: 0, tier: 'notable', label: '0°' },
    ]);
    expect(find('meridian', 0)).toEqual([
      { axis: 'meridian', value: 0, tier: 'notable', label: '0°' },
    ]);
    expect(find('parallel', -23.5)[0]).toMatchObject({ tier: 'notable', label: '23.5° S' });
    expect(lines.filter((l) => l.tier === 'notable')).toHaveLength(6);
  });

  it('labels grid lines with their hemisphere in Spanish', () => {
    expect(find('parallel', -35)[0].label).toBe('35° S');
    expect(find('parallel', 40)[0].label).toBe('40° N');
    expect(find('meridian', -65)[0].label).toBe('65° O');
    expect(find('meridian', 30)[0].label).toBe('30° E');
    expect(find('meridian', -180)[0].label).toBe('180°');
  });
});

describe('meridianCopies', () => {
  it('returns one copy per world wrap within the range', () => {
    expect(meridianCopies(-60, -500, 400)).toEqual([-420, -60, 300]);
  });

  it('includes copies that sit exactly on the range edges', () => {
    expect(meridianCopies(0, -360, 360)).toEqual([-360, 0, 360]);
  });

  it('returns nothing when no copy falls in the range', () => {
    expect(meridianCopies(0, 10, 20)).toEqual([]);
  });
});

describe('visibleGraticuleLabels', () => {
  const view = { west: -75, east: -50, south: -45, north: -30 };

  it('keeps only lines inside the view', () => {
    const { parallels, meridians } = visibleGraticuleLabels(lines, view, true);
    expect(parallels.map((l) => l.value)).toEqual([-45, -40, -35, -30]);
    expect(meridians.map((m) => m.lng)).toEqual([-75, -70, -65, -60, -55, -50]);
  });

  it('leaves minor lines out when asked to', () => {
    const { parallels, meridians } = visibleGraticuleLabels(lines, view, false);
    expect(parallels.map((l) => l.value)).toEqual([-40, -30]);
    expect(meridians.map((m) => m.lng)).toEqual([-70, -60, -50]);
  });

  it('labels meridians past the antimeridian with their wrapped longitude', () => {
    const { meridians } = visibleGraticuleLabels(lines, { ...view, west: 185, east: 195 }, true);
    expect(meridians.map((m) => [m.lng, m.line.label])).toEqual([
      [185, '175° O'],
      [190, '170° O'],
      [195, '165° O'],
    ]);
  });
});
