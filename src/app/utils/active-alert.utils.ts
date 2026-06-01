import { ActiveAlert, ActiveAlertDepartment, ActiveAlertResponse } from '../models/geo';

/**
 * Marker the backend uses when no departments fall inside the area.
 */
const NO_DEPARTMENTS_MARKER = 'Sin departamentos';

/**
 * Colors used to convey how close an active alert is to expiring.
 */
export const ACTIVE_ALERT_EXPIRY_COLORS = {
  GREEN: '#6FC040',
  YELLOW: '#F5D427',
  RED: '#C82613',
} as const;

const GREEN_THRESHOLD_MS = 30 * 60_000; // more than 30 min remaining
const YELLOW_THRESHOLD_MS = 10 * 60_000; // 10 min or less remaining → red

/**
 * Returns the color for an active alert based on how long is left until it
 * expires: green (> 30 min), yellow (11–30 min) or red (≤ 10 min).
 */
export function activeAlertColorForExpiry(endDatetime: Date, now: number = Date.now()): string {
  const remainingMs = endDatetime.getTime() - now;
  if (remainingMs > GREEN_THRESHOLD_MS) return ACTIVE_ALERT_EXPIRY_COLORS.GREEN;
  if (remainingMs > YELLOW_THRESHOLD_MS) return ACTIVE_ALERT_EXPIRY_COLORS.YELLOW;
  return ACTIVE_ALERT_EXPIRY_COLORS.RED;
}

/**
 * Parses the backend polygon string `"[lat,lon],[lat,lon],..."` (2-decimal,
 * latitude first) into Leaflet `[lat, lng]` pairs. Invalid pairs are skipped.
 */
export function parseActiveAlertPolygon(polygon: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  const pairRegex = /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;

  for (const match of polygon.matchAll(pairRegex)) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      coordinates.push([lat, lng]);
    }
  }

  return coordinates;
}

/**
 * Parses the backend `area` HTML (e.g. `"<b>PROV:</b> Dep1 - Dep2.<br /><br />..."`)
 * into affected departments with their province, sorted alphabetically by name.
 * Returns `[]` when there are none.
 */
export function parseAffectedDepartments(areaHtml: string): ActiveAlertDepartment[] {
  if (!areaHtml || areaHtml.includes(NO_DEPARTMENTS_MARKER)) {
    return [];
  }

  const departments: ActiveAlertDepartment[] = [];

  // Each province is a block separated by one or more <br>; the province name is
  // inside the leading "<b>PROVINCE:</b>" and its departments are joined by " - ".
  for (const block of areaHtml.split(/(?:<br\s*\/?>\s*)+/i)) {
    const provinceMatch = block.match(/<b>\s*(.*?)\s*:\s*<\/b>/i);
    const province = provinceMatch ? provinceMatch[1].trim() : '';

    const namesPart = block
      .replace(/<b>.*?<\/b>/i, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\.\s*$/, '')
      .trim();
    if (!namesPart) continue;

    for (const name of namesPart.split(/\s+-\s+/)) {
      const trimmed = name.trim();
      if (trimmed) {
        departments.push({ name: trimmed, province });
      }
    }
  }

  return departments.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Maps a raw backend alert into the frontend `ActiveAlert` domain model.
 */
export function toActiveAlert(res: ActiveAlertResponse): ActiveAlert {
  return {
    alertId: res.alert_id,
    phenomenon: res.phenomenon,
    departments: parseAffectedDepartments(res.area),
    coordinates: parseActiveAlertPolygon(res.polygon),
    startDatetime: new Date(res.start_datetime),
    endDatetime: new Date(res.end_datetime),
  };
}
