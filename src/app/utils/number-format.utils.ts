export function impliedMinFractionDigits(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  return Math.max(0, Math.ceil(-Math.log10(Math.abs(value))));
}

export function formatWithThousandsSeparator(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}

interface FormatDecimalOptions {
  /** Floor that survives trimming, e.g. humidity always shows 0 decimals. */
  minDecimals?: number;
  /** Strip zeros padded in only by `decimalPrecision`, never below `minDecimals`. */
  trimTrailingZeros?: boolean;
  /** `es-AR` thousands/decimal-comma grouping, for tool panels that show raw layer values. */
  groupThousands?: boolean;
}

/**
 * Decimal formatter underlying the app's value displays. Fraction digits are
 * `max(minDecimals, decimalPrecision, impliedMinFractionDigits(value))` — the
 * user's global precision setting raises decimals everywhere, while small
 * values (e.g. 0.003) still get enough digits to not round to 0.
 *
 * Prefer the wrappers below (`formatStationValue`, `formatScaleLabel`,
 * `formatPointQueryValue`) at call sites; reach for this directly only for a
 * new display shape they don't cover.
 */
export function formatDecimal(
  value: number,
  decimalPrecision: number,
  { minDecimals = 0, trimTrailingZeros = false, groupThousands = false }: FormatDecimalOptions = {},
): string {
  const fractionDigits = Math.max(minDecimals, decimalPrecision, impliedMinFractionDigits(value));
  const formatted = groupThousands
    ? new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
    : value.toFixed(fractionDigits);

  if (!trimTrailingZeros) {
    return formatted;
  }

  const decimalSeparator = groupThousands ? ',' : '.';
  const separatorIndex = formatted.lastIndexOf(decimalSeparator);
  if (separatorIndex === -1) {
    return formatted;
  }

  const head = formatted.slice(0, separatorIndex);
  const fraction = formatted.slice(separatorIndex + 1);
  let end = fraction.length;
  while (end > minDecimals && fraction[end - 1] === '0') end--;

  return end > 0 ? `${head}${decimalSeparator}${fraction.slice(0, end)}` : head;
}

/**
 * A station/layer reading with a known minimum precision (e.g. temperature
 * always 1 decimal, humidity 0) that still respects the user's global
 * decimal-precision setting without padding it with meaningless zeros.
 */
export function formatStationValue(
  value: number,
  decimalPrecision: number,
  minDecimals = 0,
): string {
  return formatDecimal(value, decimalPrecision, { minDecimals, trimTrailingZeros: true });
}

/** A scale's fixed threshold labels — grouped like a raw layer value, trimmed since the exact precision doesn't matter. */
export function formatScaleLabel(value: number, decimalPrecision: number): string {
  return formatDecimal(value, decimalPrecision, { groupThousands: true, trimTrailingZeros: true });
}

/** A point-query/scale-tool raw value — grouped, full precision (no trimming: the point is to show it exactly). */
export function formatPointQueryValue(value: number, decimalPrecision: number): string {
  return formatDecimal(value, decimalPrecision, { groupThousands: true });
}
