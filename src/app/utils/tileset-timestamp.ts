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

export function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

// ============================================================================
// ECMWF Timestamp Parsing & Formatting
// ============================================================================

export function parseEcmwfTimestamp(ts: string): Date | null {
  if (ts.length < 13) return null;

  const year = parseInt(ts.substring(0, 4));
  const month = parseInt(ts.substring(4, 6)) - 1;
  const day = parseInt(ts.substring(6, 8));
  const hour = parseInt(ts.substring(9, 11));
  const minute = parseInt(ts.substring(11, 13));

  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}

// ============================================================================
// WRF Timestamp Parsing & Formatting
// ============================================================================

export function parseWrfInitTag(initTag: string): Date | null {
  if (initTag.length < 15 || initTag.charAt(8) !== '_') return null;
  const year = parseInt(initTag.substring(0, 4));
  const month = parseInt(initTag.substring(4, 6)) - 1;
  const day = parseInt(initTag.substring(6, 8));
  const hour = parseInt(initTag.substring(9, 11));
  const minute = parseInt(initTag.substring(11, 13));
  const second = parseInt(initTag.substring(13, 15));
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export function parseWrfStepTimestamp(initTag: string, fxxx: string): Date | null {
  const init = parseWrfInitTag(initTag);
  if (!init) return null;
  if (!fxxx.startsWith('F')) return init;
  const offsetH = parseInt(fxxx.substring(1));
  if (Number.isNaN(offsetH)) return init;
  return new Date(init.getTime() + offsetH * 3_600_000);
}

export function wrfFxxxForInitAndTime(initTag: string, time: Date): string | null {
  const init = parseWrfInitTag(initTag);
  if (!init) return null;
  const offsetH = Math.round((time.getTime() - init.getTime()) / 3_600_000);
  if (offsetH < 0) return null;
  return 'F' + String(offsetH).padStart(3, '0');
}

export function formatWrfInitTag(initTag: string): string {
  const dt = parseWrfInitTag(initTag);
  if (!dt) return initTag;
  const utc = shouldUseUtc();
  const mo = String((utc ? dt.getUTCMonth() : dt.getMonth()) + 1).padStart(2, '0');
  const dd = String(utc ? dt.getUTCDate() : dt.getDate()).padStart(2, '0');
  const hh = String(utc ? dt.getUTCHours() : dt.getHours()).padStart(2, '0');
  return `${mo}-${dd} ${hh}h`;
}

// ============================================================================
// Generic Formatting
// ============================================================================

export function formatDateTimeOnly(date: Date): string {
  const hours = shouldUseUtc() ? date.getUTCHours() : date.getHours();
  const minutes = shouldUseUtc() ? date.getUTCMinutes() : date.getMinutes();

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatDateOnly(date: Date): string {
  const yyyy = shouldUseUtc() ? date.getUTCFullYear() : date.getFullYear();
  const mo = String((shouldUseUtc() ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
  const dd = String(shouldUseUtc() ? date.getUTCDate() : date.getDate()).padStart(2, '0');

  return `${yyyy}-${mo}-${dd}`;
}

export function formatDateFull(date: Date): string {
  return `${formatDateOnly(date)} ${formatDateTimeOnly(date)}`;
}

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
