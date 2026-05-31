/**
 * Returns the minimum fraction digits needed to represent `value` without
 * losing precision at its order of magnitude.
 *
 * Examples: 0.01 → 2, 0.1 → 1, 1 → 0, 128 → 0.
 */
export function impliedMinFractionDigits(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  return Math.max(0, Math.ceil(-Math.log10(Math.abs(value))));
}
