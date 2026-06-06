export interface WindDirectionOptions {
  size: number;
  /** Triangle fill colour (the wind-speed scale colour). */
  color: string;
}

export function windDirectionTriangleSvg(deg: number, opts: WindDirectionOptions): string {
  const { size, color } = opts;
  const c = size / 2;
  const halfBase = size * 0.18;
  const topY = c - size * 0.22;
  const apexY = c + size * 0.44;
  const strokeW = (size * 0.04).toFixed(2);
  const blur = (size * 0.06).toFixed(2);

  const defs = `<defs><filter id="wd-halo" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="${blur}" flood-color="#ffffff" flood-opacity="1" /></filter></defs>`;
  const tri = `<path d="M ${(c - halfBase).toFixed(2)} ${topY.toFixed(2)} L ${(c + halfBase).toFixed(2)} ${topY.toFixed(2)} L ${c} ${apexY.toFixed(2)} Z" />`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">${defs}<g filter="url(#wd-halo)" transform="rotate(${deg} ${c} ${c})" fill="${color}" stroke="${color}" stroke-width="${strokeW}" stroke-linejoin="round">${tri}</g></svg>`;
}
