import { describe, it, expect } from 'vitest';
import { fit } from './context-menu-position.directive';

describe('fit', () => {
  it('opens after the anchor when there is room', () => {
    expect(fit(100, 200, 1000)).toBe(100);
  });

  it('opens before the anchor near the far edge', () => {
    expect(fit(900, 200, 1000)).toBe(700);
  });

  it('clamps inside the edges when neither side fits', () => {
    expect(fit(150, 400, 500)).toBe(92);
  });

  it('never starts before the near margin', () => {
    expect(fit(50, 600, 500)).toBe(8);
  });
});
