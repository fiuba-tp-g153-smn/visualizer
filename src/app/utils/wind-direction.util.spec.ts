import { describe, it, expect } from 'vitest';

import { windDirectionTriangleSvg } from './wind-direction.util';

const OPTS = { size: 40, color: '#3a86ff' };

/** Parse the three [x, y] vertices out of the triangle `<path d="M … L … L … Z">`. */
function trianglePoints(svg: string): Array<{ x: number; y: number }> {
  const d = /<path d="([^"]+)"/.exec(svg)?.[1] ?? '';
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

describe('windDirectionTriangleSvg', () => {
  it('draws a single closed triangle path', () => {
    const svg = windDirectionTriangleSvg(0, OPTS);
    expect(svg.split('<path').length - 1).toBe(1);
    expect(svg).toContain('Z');
  });

  it('applies the bearing verbatim, with no offset', () => {
    expect(windDirectionTriangleSvg(135, OPTS)).toContain('rotate(135 ');
    expect(windDirectionTriangleSvg(0, OPTS)).toContain('rotate(0 ');
  });

  it('fills the triangle with the given colour', () => {
    expect(windDirectionTriangleSvg(90, { size: 40, color: '#112233' })).toContain(
      'fill="#112233"',
    );
  });

  it('points the apex downwind (apex below the base, centred) at deg 0', () => {
    const [left, right, apex] = trianglePoints(windDirectionTriangleSvg(0, OPTS));
    // Base corners share the top y; the apex sits lower on the canvas (larger y).
    expect(left.y).toBeCloseTo(right.y);
    expect(apex.y).toBeGreaterThan(left.y);
    // ...and is horizontally centred between them.
    expect(apex.x).toBeCloseTo((left.x + right.x) / 2);
  });

  it('is a slim isosceles pointer (taller than it is wide), not equilateral', () => {
    const [left, right, apex] = trianglePoints(windDirectionTriangleSvg(0, OPTS));
    const baseWidth = Math.abs(right.x - left.x);
    const height = apex.y - left.y;
    expect(height).toBeGreaterThan(baseWidth);
  });
});
