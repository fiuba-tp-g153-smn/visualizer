/**
 * Helpers de formato puros para el panel de rendimiento. Sin estado y sin
 * dependencias de Angular, de modo que son triviales de testear.
 */

/** Segundos legibles: 2 decimales bajo 10 s, 1 decimal por encima. `—` si null. */
export function secs(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return (value < 10 ? value.toFixed(2) : value.toFixed(1)) + 's';
}

/** Fracción [0,1] como porcentaje con un decimal. `—` si null. */
export function pct(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return (value * 100).toFixed(1) + '%';
}

/**
 * Antigüedad relativa en español ("hace 3m"). `now` es inyectable para tests.
 */
export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) {
    return '—';
  }
  const seconds = (now - new Date(iso).getTime()) / 1000;
  if (!isFinite(seconds)) {
    return '—';
  }
  if (seconds < 60) {
    return 'hace ' + Math.floor(seconds) + 's';
  }
  if (seconds < 3600) {
    return 'hace ' + Math.floor(seconds / 60) + 'm';
  }
  if (seconds < 86400) {
    return 'hace ' + Math.floor(seconds / 3600) + 'h';
  }
  return 'hace ' + Math.floor(seconds / 86400) + 'd';
}

/**
 * Etiqueta corta de un bucket ISO8601. El ancho del string codifica el
 * intervalo (igual que en el backend): 15 chars → 10 min ("MM-DD HH:M0"),
 * 13 → hora ("MM-DD HHh"), 10 → día ("MM-DD").
 */
export function fmtBucket(bucket: string): string {
  if (bucket.length >= 15) {
    return bucket.slice(5, 10) + ' ' + bucket.slice(11, 13) + ':' + bucket.slice(14, 15) + '0';
  }
  if (bucket.length >= 13) {
    return bucket.slice(5, 10) + ' ' + bucket.slice(11, 13) + 'h';
  }
  return bucket.slice(5, 10);
}
