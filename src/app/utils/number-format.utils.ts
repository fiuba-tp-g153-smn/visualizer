export function impliedMinFractionDigits(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  return Math.max(0, Math.ceil(-Math.log10(Math.abs(value))));
}

export function formatWithThousandsSeparator(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}
