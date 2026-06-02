export interface WindDirectionOptions {
  size: number;
  /** Triangle fill colour (the wind-speed scale colour). */
  color: string;
}

/**
 * Wind-direction triangle as a self-contained SVG string (for a Leaflet DivIcon),
 * centred on the station and pointing downwind. Mirrors the right-click popover's
 * `wind-compass` arrow: the meteorological bearing `deg` (0 = N, clockwise, the
 * direction the wind comes *from*) is applied verbatim with NO offset, so at
 * `deg = 0` the apex points straight down (downwind), matching the compass. A white
 * drop-shadow halo keeps it legible over the basemap.
 */
export function windDirectionTriangleSvg(deg: number, opts: WindDirectionOptions): string {
  const { size, color } = opts;
  const c = size / 2;
  // Slim isosceles pointer (taller than wide) so the apex clearly shows direction;
  // centroid stays at the centre (apex offset = 2 × base offset) for clean rotation.
  const halfBase = size * 0.18;
  const topY = c - size * 0.22; // base across the top
  const apexY = c + size * 0.44; // long apex below the centre (downwind at deg = 0)
  const strokeW = (size * 0.04).toFixed(2);
  const blur = (size * 0.06).toFixed(2);

  const defs = `<defs><filter id="wd-halo" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="${blur}" flood-color="#ffffff" flood-opacity="1" /></filter></defs>`;
  const tri = `<path d="M ${(c - halfBase).toFixed(2)} ${topY.toFixed(2)} L ${(c + halfBase).toFixed(2)} ${topY.toFixed(2)} L ${c} ${apexY.toFixed(2)} Z" />`;
  // overflow:visible so the halo isn't clipped by the square viewport.
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">${defs}<g filter="url(#wd-halo)" transform="rotate(${deg} ${c} ${c})" fill="${color}" stroke="${color}" stroke-width="${strokeW}" stroke-linejoin="round">${tri}</g></svg>`;
}
