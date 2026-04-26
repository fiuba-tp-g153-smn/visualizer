/**
 * Parses GOES timestamp in Julian format YYYYJJJHHMMSSS.
 * Returns Date in local time.
 */
export function parseGoesTimestamp(tileset: string): Date | null {
  if (tileset.length < 11) return null;

  const year = parseInt(tileset.substring(0, 4));
  const dayOfYear = parseInt(tileset.substring(4, 7));
  const hour = parseInt(tileset.substring(7, 9));
  const minute = parseInt(tileset.substring(9, 11));

  const date = new Date(year, 0);
  date.setDate(dayOfYear);
  date.setHours(hour, minute, 0, 0);

  return date;
}

/**
 * Parses Radar timestamp in ISO-like format YYYYMMDDTHHMMSSZ.
 * Returns Date in local time.
 */
export function parseRadarTimestamp(tileset: string): Date | null {
  if (tileset.length < 15) return null;

  const year = parseInt(tileset.substring(0, 4));
  const month = parseInt(tileset.substring(4, 6)) - 1;
  const day = parseInt(tileset.substring(6, 8));
  const hour = parseInt(tileset.substring(9, 11));
  const minute = parseInt(tileset.substring(11, 13));
  const second = parseInt(tileset.substring(13, 15));

  return new Date(year, month, day, hour, minute, second);
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

  return new Date(year, month, day, hour, minute, 0);
}

/**
 * Parses the centered timestamp of an ECMWF accumulation window.
 * Example: "20260330T1500Z" → Date for 2026-03-30 15:00
 */
export function parseEcmwfPeriodCenter(periodTs: string): Date | null {
  return parseEcmwfTimestamp(periodTs);
}

/**
 * Formats an ECMWF forecast timestamp as ISO 8601 for display.
 * Example: "20260330T1200Z" → "2026-03-30T12:00Z"
 */
export function formatEcmwfForecastTs(forecastTs: string): string {
  if (forecastTs.length < 13) return forecastTs;

  return `${forecastTs.substring(0, 4)}-${forecastTs.substring(4, 6)}-${forecastTs.substring(6, 8)}T${forecastTs.substring(9, 11)}:${forecastTs.substring(11, 13)}Z`;
}

// ============================================================================
// Generic Formatting
// ============================================================================

/**
 * Formats a Date as "HH:MM".
 */
export function formatDateTimeOnly(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Formats a Date as "YYYY-MM-DD HH:MM".
 */
export function formatDateFull(date: Date): string {
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${formatDateTimeOnly(date)}`;
}
