/**
 * Parses GOES timestamp in Julian format YYYYJJJHHMMSSS.
 * Returns Date interpreted as UTC timestamp.
 */
export const TIMESTAMP_TIMEZONE_MODES = {
  UTC: 'utc',
  LOCAL: 'local',
} as const;

export type TimestampTimezoneMode =
  (typeof TIMESTAMP_TIMEZONE_MODES)[keyof typeof TIMESTAMP_TIMEZONE_MODES];

const UTC_TIMEZONE = 'UTC';
const DEFAULT_DATE_TIME_LOCALE = 'es-AR';

let timestampTimezoneMode: TimestampTimezoneMode = TIMESTAMP_TIMEZONE_MODES.LOCAL;

export function setTimestampTimezoneMode(mode: TimestampTimezoneMode): void {
  timestampTimezoneMode = mode;
}

function shouldUseUtc(): boolean {
  return timestampTimezoneMode === TIMESTAMP_TIMEZONE_MODES.UTC;
}

export function parseGoesTimestamp(tileset: string): Date | null {
  if (tileset.length < 11) return null;

  const year = parseInt(tileset.substring(0, 4));
  const dayOfYear = parseInt(tileset.substring(4, 7));
  const hour = parseInt(tileset.substring(7, 9));
  const minute = parseInt(tileset.substring(9, 11));

  const date = new Date(Date.UTC(year, 0, 1, hour, minute, 0, 0));
  date.setUTCDate(dayOfYear);

  return date;
}

/**
 * Parses Radar timestamp in ISO-like format YYYYMMDDTHHMMSSZ.
 * Returns Date interpreted as UTC timestamp.
 */
export function parseRadarTimestamp(tileset: string): Date | null {
  if (tileset.length < 15) return null;

  const year = parseInt(tileset.substring(0, 4));
  const month = parseInt(tileset.substring(4, 6)) - 1;
  const day = parseInt(tileset.substring(6, 8));
  const hour = parseInt(tileset.substring(9, 11));
  const minute = parseInt(tileset.substring(11, 13));
  const second = parseInt(tileset.substring(13, 15));

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Formats a duration in milliseconds as "Xmin" or "Xs".
 */
export function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

// ============================================================================
// ECMWF Timestamp Parsing & Formatting
// ============================================================================

/**
 * Parses ECMWF timestamp in format YYYYMMDDTHHMMZ (14 chars, no seconds).
 * Example: "20260330T1500Z" → Date(2026, 2, 30, 15, 0)
 */
export function parseEcmwfTimestamp(ts: string): Date | null {
  if (ts.length < 13) return null;

  const year = parseInt(ts.substring(0, 4));
  const month = parseInt(ts.substring(4, 6)) - 1;
  const day = parseInt(ts.substring(6, 8));
  const hour = parseInt(ts.substring(9, 11));
  const minute = parseInt(ts.substring(11, 13));

  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}

/**
 * Formats an ECMWF forecast timestamp as "MM-DD HHh" for compact display.
 * Example: "20260502T1200Z" → "05-02 12h"
 */
export function formatEcmwfForecastTs(forecastTs: string): string {
  if (forecastTs.length < 13) return forecastTs;

  const month = forecastTs.substring(4, 6);
  const day = forecastTs.substring(6, 8);
  const hour = forecastTs.substring(9, 11);
  return `${month}-${day} ${hour}h`;
}

// ============================================================================
// WRF Timestamp Parsing & Formatting
// ============================================================================

/**
 * Parsea un init_tag WRF en formato 'YYYYMMDD_HHMMSS'.
 * Ejemplo: '20260430_060000' → Date(2026, 3, 30, 6, 0, 0)
 */
export function parseWrfInitTag(initTag: string): Date | null {
  if (initTag.length < 15 || initTag.charAt(8) !== '_') return null;
  const year = parseInt(initTag.substring(0, 4));
  const month = parseInt(initTag.substring(4, 6)) - 1;
  const day = parseInt(initTag.substring(6, 8));
  const hour = parseInt(initTag.substring(9, 11));
  const minute = parseInt(initTag.substring(11, 13));
  const second = parseInt(initTag.substring(13, 15));
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Sintetiza el Date de un (init_tag, fxxx) WRF como init + N horas.
 * Ejemplo: ('20260430_060000', 'F003') → 2026-04-30 09:00.
 */
export function parseWrfStepTimestamp(initTag: string, fxxx: string): Date | null {
  const init = parseWrfInitTag(initTag);
  if (!init) return null;
  if (!fxxx.startsWith('F')) return init;
  const offsetH = parseInt(fxxx.substring(1));
  if (Number.isNaN(offsetH)) return init;
  return new Date(init.getTime() + offsetH * 3_600_000);
}

/**
 * Formato compacto para init_tag WRF (mostrar en filtros): "MM-DD HHh".
 */
export function formatWrfInitTag(initTag: string): string {
  const dt = parseWrfInitTag(initTag);
  if (!dt) return initTag;
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  return `${mo}-${dd} ${hh}h`;
}

// ============================================================================
// Generic Formatting
// ============================================================================

/**
 * Formats a Date as "HH:MM".
 */
export function formatDateTimeOnly(date: Date): string {
  const hours = shouldUseUtc() ? date.getUTCHours() : date.getHours();
  const minutes = shouldUseUtc() ? date.getUTCMinutes() : date.getMinutes();

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Formats a Date as "YYYY-MM-DD HH:MM".
 */
export function formatDateFull(date: Date): string {
  const yyyy = shouldUseUtc() ? date.getUTCFullYear() : date.getFullYear();
  const mo = String((shouldUseUtc() ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
  const dd = String(shouldUseUtc() ? date.getUTCDate() : date.getDate()).padStart(2, '0');

  return `${yyyy}-${mo}-${dd} ${formatDateTimeOnly(date)}`;
}

/**
 * Formats a Date as localized date-time string (es-AR by default).
 */
export function formatDateTimeLocalized(date: Date, locale = DEFAULT_DATE_TIME_LOCALE): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: shouldUseUtc() ? UTC_TIMEZONE : undefined,
  });

  return formatter.format(date);
}
