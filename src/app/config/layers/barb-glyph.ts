// ============================================================================
// Wind barbs — meteorological glyph (pennant / flag / half-flag) matching the
// SMN style. The backend emits Point features with `speed_kt` and `dir_deg`.
// The glyph is a black SVG with no per-intensity color: intensity is encoded
// entirely by the number of pennants / flags / halves.
//
// Compartido por todos los modelos que emiten barbas (WRF y GFS).
// ============================================================================

const COLOR_BARB_BLACK = '#000000';

const BARB_STAFF = 16;
const BARB_FLAG_LEN = 7;
const BARB_HALF_LEN = 3.5;
const BARB_PENNANT_HEIGHT = 7;
const BARB_STEP = 3.2;

/**
 * Genera markup SVG de UN barb (sin `<svg>` wrapper) posicionado en (cx, cy).
 * Pensado para componer múltiples glyphs dentro de un mismo `<svg>` por tile.
 *
 * Convención SMN hemisferio sur: pennants / flags / halves a la IZQUIERDA del
 * staff (mirando desde station hacia la punta).
 */
export function renderBarbGlyphMarkup(
  speed_kt: number,
  dir_deg: number,
  cx: number,
  cy: number,
  scale = 1,
): string {
  const staff = BARB_STAFF * scale;
  const flagLen = BARB_FLAG_LEN * scale;
  const halfLen = BARB_HALF_LEN * scale;
  const pennantH = BARB_PENNANT_HEIGHT * scale;
  const step = BARB_STEP * scale;
  const gap = 1.2 * scale;
  const sw = Math.max(0.5, 0.9 * Math.sqrt(scale));

  const speed = Math.round(Math.max(0, speed_kt) / 5) * 5;

  if (speed < 5) {
    const r = (2 * scale).toFixed(2);
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="none" stroke="${COLOR_BARB_BLACK}" stroke-width="${(0.8 * Math.sqrt(scale)).toFixed(2)}"/>`;
  }

  const theta = (dir_deg * Math.PI) / 180;
  const sx = staff * Math.sin(theta);
  const sy = -staff * Math.cos(theta);
  const px = -Math.cos(theta);
  const py = -Math.sin(theta);

  const at = (d: number): { x: number; y: number } => ({
    x: cx + (sx * d) / staff,
    y: cy + (sy * d) / staff,
  });

  const pennants = Math.floor(speed / 50);
  const rest = speed - pennants * 50;
  const flags = Math.floor(rest / 10);
  const halves = Math.floor((rest - flags * 10) / 5);

  const parts: string[] = [];
  parts.push(
    `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx + sx).toFixed(2)}" y2="${(cy + sy).toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
  );

  let d = staff;
  for (let i = 0; i < pennants; i++) {
    const a = at(d);
    const b = at(d - step);
    const c = { x: a.x + px * pennantH, y: a.y + py * pennantH };
    parts.push(
      `<polygon points="${a.x.toFixed(2)},${a.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}" fill="${COLOR_BARB_BLACK}" stroke="${COLOR_BARB_BLACK}" stroke-width="${(0.5 * scale).toFixed(2)}"/>`,
    );
    d -= step;
  }
  if (pennants > 0) d -= gap;

  for (let i = 0; i < flags; i++) {
    const a = at(d);
    const b = { x: a.x + px * flagLen, y: a.y + py * flagLen };
    parts.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
    );
    d -= step;
  }

  if (halves > 0) {
    if (flags === 0 && pennants === 0) d = staff - step;
    const a = at(d);
    const b = { x: a.x + px * halfLen, y: a.y + py * halfLen };
    parts.push(
      `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_BARB_BLACK}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
    );
  }

  return parts.join('');
}
