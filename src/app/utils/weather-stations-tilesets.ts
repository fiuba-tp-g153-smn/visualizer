/** Weather-station tilesets are hourly buckets named `YYYYMMDDTHH00Z`. */
const TILESET_ID_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})00Z$/;

/** The instant (ms since epoch) a weather-station tileset id stands for, or null if malformed. */
export function weatherStationsTilesetTime(tilesetId: string): number | null {
  const match = tilesetId.match(TILESET_ID_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour] = match;
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour));
  return Number.isNaN(time) ? null : time;
}
