import { LayerCategory } from '../models/layers/models';

/**
 * Parses a tileset ID to a Date based on layer category.
 */
export function parseTilesetTimestamp(tileset: string, category: LayerCategory): Date | null {
  switch (category) {
    case LayerCategory.GOES_19:
      return parseGoesTimestamp(tileset);
    case LayerCategory.RADAR:
      return parseRadarTimestamp(tileset);
    default:
      return null;
  }
}

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
 * Formats a tileset ID as "HH:MM" based on layer category.
 */
export function formatTilesetTimeOnly(tileset: string, category: LayerCategory): string {
  const date = parseTilesetTimestamp(tileset, category);
  if (!date) return '--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formats a tileset ID as "YYYY-MM-DD HH:MM" based on layer category.
 */
export function formatTilesetFullLabel(tileset: string, category: LayerCategory): string {
  const date = parseTilesetTimestamp(tileset, category);
  if (!date) return tileset;
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
}

/**
 * Formats a duration in milliseconds as "Xmin" or "Xs".
 */
export function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

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
