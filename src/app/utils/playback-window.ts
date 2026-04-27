/**
 * Playback window helpers.
 *
 * Historical layers (radar, GOES) animate the LAST N tilesets — the most recent
 * observations. Forecast layers (ECMWF) animate the FIRST N — the timestamps
 * closest to "now" within the forecast horizon.
 */

/**
 * Returns the start index of the N-frame playback window inside an ordered
 * tileset list (sorted ascending by time).
 */
export function computeWindowStart(
  totalTilesets: number,
  frameCount: number,
  isForecast: boolean,
): number {
  if (isForecast) return 0;
  return Math.max(0, totalTilesets - frameCount);
}

/**
 * Returns the default cursor index when no explicit timeIndex is set:
 * the first frame for forecasts, the last frame for historical layers.
 */
export function getDefaultCursorIndex(totalTilesets: number, isForecast: boolean): number {
  if (totalTilesets <= 0) return 0;
  return isForecast ? 0 : totalTilesets - 1;
}
