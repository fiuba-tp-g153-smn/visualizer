export const TIMESTAMP_TIMEZONE_MODES = {
  UTC: 'utc',
  HOA: 'hoa',
} as const;

export type TimestampTimezoneMode =
  (typeof TIMESTAMP_TIMEZONE_MODES)[keyof typeof TIMESTAMP_TIMEZONE_MODES];

// Argentina has used a fixed UTC-3 offset (no DST) since 2009.
const HOA_OFFSET_MS = -3 * 60 * 60 * 1000;

interface TimezoneDisplayConfig {
  readonly suffix: string;
  readonly offsetMs: number;
}

let timestampTimezoneMode: TimestampTimezoneMode = TIMESTAMP_TIMEZONE_MODES.HOA;

export function setTimestampTimezoneMode(mode: TimestampTimezoneMode): void {
  timestampTimezoneMode = mode;
}

function resolveTimezoneConfig(): TimezoneDisplayConfig {
  switch (timestampTimezoneMode) {
    case TIMESTAMP_TIMEZONE_MODES.UTC:
      return { suffix: 'UTC', offsetMs: 0 };
    case TIMESTAMP_TIMEZONE_MODES.HOA:
      return { suffix: 'HOA', offsetMs: HOA_OFFSET_MS };
  }
}

function toDisplayDate(date: Date): Date {
  return new Date(date.getTime() + resolveTimezoneConfig().offsetMs);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
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
  return formatRunLabel(dt);
}

// ============================================================================
// GFS Timestamp Parsing & Formatting
// ============================================================================
//
// GFS names its runs `YYYYMMDDTHHmmZ` (e.g. `20260808T0600Z`) and its steps
// `fXXX` (e.g. `f003`), where XXX is the forecast offset in whole hours. Steps
// are 3-hourly out to +48h and 6-hourly beyond, but the offset is always
// integral, so a step maps to an absolute instant and back without ambiguity.

export function parseGfsCycleTag(cycle: string): Date | null {
  if (cycle.length < 14 || cycle.charAt(8) !== 'T') return null;
  const year = parseInt(cycle.substring(0, 4));
  const month = parseInt(cycle.substring(4, 6)) - 1;
  const day = parseInt(cycle.substring(6, 8));
  const hour = parseInt(cycle.substring(9, 11));
  const minute = parseInt(cycle.substring(11, 13));
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}

export function parseGfsStepTimestamp(cycle: string, fxxx: string): Date | null {
  const init = parseGfsCycleTag(cycle);
  if (!init) return null;
  if (!fxxx.startsWith('f')) return init;
  const offsetH = parseInt(fxxx.substring(1));
  if (Number.isNaN(offsetH)) return init;
  return new Date(init.getTime() + offsetH * 3_600_000);
}

/** Inverse of `parseGfsStepTimestamp`: absolute instant → that cycle's `fxxx`. */
export function gfsFxxxForCycleAndTime(cycle: string, time: Date): string | null {
  const init = parseGfsCycleTag(cycle);
  if (!init) return null;
  const offsetH = Math.round((time.getTime() - init.getTime()) / 3_600_000);
  if (offsetH < 0) return null;
  return 'f' + String(offsetH).padStart(3, '0');
}

export function formatGfsCycleTag(cycle: string): string {
  const dt = parseGfsCycleTag(cycle);
  if (!dt) return cycle;
  return formatRunLabel(dt);
}

/** Compact "MM-DD HHh" label shared by every forecast-model run selector. */
function formatRunLabel(dt: Date): string {
  const d = toDisplayDate(dt);
  const mo = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  return `${mo}-${dd} ${hh}h ${resolveTimezoneConfig().suffix}`;
}

// ============================================================================
// Generic Formatting
// ============================================================================

export function formatDateTimeOnly(date: Date): string {
  const d = toDisplayDate(date);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function formatDateOnly(date: Date): string {
  const d = toDisplayDate(date);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function formatDateFull(date: Date): string {
  return `${formatDateOnly(date)} ${formatDateTimeOnly(date)} ${resolveTimezoneConfig().suffix}`;
}
