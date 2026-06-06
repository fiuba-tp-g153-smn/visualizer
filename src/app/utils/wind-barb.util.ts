export interface WindBarbOptions {
  size: number;
  /** Barb stroke colour (standard barbs are black). */
  color: string;
}

const HALF_BARB = 5;
const FULL_BARB = 10;
const PENNANT = 50;

interface BarbCounts {
  pennants: number;
  fulls: number;
  halves: number;
}

export function decomposeBarb(knots: number): BarbCounts {
  let remaining = Math.round((Number.isFinite(knots) ? knots : 0) / 5) * 5;
  const pennants = Math.floor(remaining / PENNANT);
  remaining -= pennants * PENNANT;
  const fulls = Math.floor(remaining / FULL_BARB);
  remaining -= fulls * FULL_BARB;
  const halves = Math.floor(remaining / HALF_BARB);
  return { pennants, fulls, halves };
}

export function windBarbSvg(speedKnots: number, deg: number | null, opts: WindBarbOptions): string {
  const { size, color } = opts;
  const c = size / 2;
  const strokeW = Math.max(1, size * 0.06);
  const defs = `<defs><filter id="wb-halo" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="${(size * 0.03).toFixed(2)}" flood-color="#ffffff" flood-opacity="1" /></filter></defs>`;
  const open = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">${defs}`;
  const close = `</svg>`;

  const rounded = Math.round((Number.isFinite(speedKnots) ? speedKnots : 0) / 5) * 5;
  const hasBearing = deg !== null && deg !== undefined && Number.isFinite(deg);

  if (rounded <= 0 || !hasBearing) {
    const r = (size * 0.13).toFixed(2);
    return `${open}<g filter="url(#wb-halo)" fill="none" stroke="${color}" stroke-width="${strokeW.toFixed(2)}"><circle cx="${c}" cy="${c}" r="${r}" /></g>${close}`;
  }

  const { pennants, fulls, halves } = decomposeBarb(speedKnots);
  const staffLen = size * 0.42;
  const barbLen = size * 0.3;
  const step = size * 0.1;
  const rise = barbLen * 0.45;
  const top = c - staffLen;

  const parts: string[] = [`<line x1="${c}" y1="${c}" x2="${c}" y2="${top.toFixed(2)}" />`];
  let y = top;
  for (let i = 0; i < pennants; i += 1) {
    parts.push(
      `<path d="M ${c} ${y.toFixed(2)} L ${(c - barbLen).toFixed(2)} ${(y + step * 0.5).toFixed(2)} L ${c} ${(y + step).toFixed(2)} Z" />`,
    );
    y += step + size * 0.03;
  }
  for (let i = 0; i < fulls; i += 1) {
    parts.push(
      `<line x1="${c}" y1="${y.toFixed(2)}" x2="${(c - barbLen).toFixed(2)}" y2="${(y - rise).toFixed(2)}" />`,
    );
    y += step;
  }
  if (halves > 0) {
    if (pennants === 0 && fulls === 0) {
      y += step;
    }
    parts.push(
      `<line x1="${c}" y1="${y.toFixed(2)}" x2="${(c - barbLen * 0.5).toFixed(2)}" y2="${(y - rise * 0.5).toFixed(2)}" />`,
    );
  }

  return `${open}<g filter="url(#wb-halo)" transform="rotate(${deg} ${c} ${c})" fill="${color}" stroke="${color}" stroke-width="${strokeW.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g>${close}`;
}
