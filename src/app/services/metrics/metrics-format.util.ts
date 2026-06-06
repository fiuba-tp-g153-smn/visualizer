import { formatDateTimeLocalized } from '../../utils/tileset-timestamp';

export function secs(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return (value < 10 ? value.toFixed(2) : value.toFixed(1)) + 's';
}

export function pct(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return (value * 100).toFixed(1) + '%';
}

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
 * Etiqueta de eje para un bucket de la API. El bucket es un prefijo ISO **UTC**
 * truncado (la API agrupa cortando el string): hora `"2026-06-04T21"` (13),
 * 10 min `"2026-06-04T21:3"` (15) o día `"2026-06-04"` (10). Con `utc=false`
 * reconstruimos el instante y lo mostramos en hora local del navegador (mismo
 * patrón que `formatWrfInitTag`). Los buckets por día no tienen hora y su corte
 * es por día UTC, así que se muestran tal cual en ambos modos.
 */
export function fmtBucket(bucket: string, utc = true): string {
  if (bucket.length < 13) {
    return bucket.slice(5, 10);
  }
  const minuteTens = bucket.length >= 15 ? bucket.slice(14, 15) : '0';
  const d = new Date(`${bucket.slice(0, 13)}:${minuteTens}0:00Z`);
  const mo = String((utc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
  const dd = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, '0');
  const hh = String(utc ? d.getUTCHours() : d.getHours()).padStart(2, '0');
  if (bucket.length >= 15) {
    const mi = String(utc ? d.getUTCMinutes() : d.getMinutes()).padStart(2, '0');
    return `${mo}-${dd} ${hh}:${mi}`;
  }
  return `${mo}-${dd} ${hh}h`;
}

/**
 * Formatea un instante ISO absoluto (p. ej. `started_at`) en UTC o en hora local
 * según el toggle de zona horaria, reutilizando `formatDateTimeLocalized`. Para
 * relativos ("hace 5m") usar `ago`, que no depende de la zona.
 */
export function fmtInstant(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : formatDateTimeLocalized(d);
}
