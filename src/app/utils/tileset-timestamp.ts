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
 * Splits an ECMWF forecast timestamp into separate date and time parts.
 * Example: "20260502T1200Z" → { date: "2026-05-02", time: "12:00" }
 */
export interface EcmwfForecastTsParts {
  readonly date: string;
  readonly time: string;
}

export function formatEcmwfForecastTsParts(forecastTs: string): EcmwfForecastTsParts {
  if (forecastTs.length < 13) return { date: forecastTs, time: '' };

  const year = forecastTs.substring(0, 4);
  const month = forecastTs.substring(4, 6);
  const day = forecastTs.substring(6, 8);
  const hour = forecastTs.substring(9, 11);
  const minute = forecastTs.substring(11, 13);
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
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
