import {
  ActiveAlert,
  ActiveAlertDepartment,
  ActiveAlertResponse,
  Department,
  PendingAlert,
  PendingAlertResponse,
} from '../models/geo';
import { DepartmentListItem } from '../components/overlay/main-menu/alerts-panel/department-list/department-list';

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

export function activeAlertColorForExpiry(endDatetime: Date, now: number = Date.now()): string {
  const remainingMs = endDatetime.getTime() - now;
  if (remainingMs > GREEN_THRESHOLD_MS) return ACTIVE_ALERT_EXPIRY_COLORS.GREEN;
  if (remainingMs > YELLOW_THRESHOLD_MS) return ACTIVE_ALERT_EXPIRY_COLORS.YELLOW;
  return ACTIVE_ALERT_EXPIRY_COLORS.RED;
}

export function formatActiveAlertRemaining(endDatetime: Date, now: number = Date.now()): string {
  const remainingMs = endDatetime.getTime() - now;
  if (remainingMs <= 0) return 'Vencido';

  const totalMinutes = Math.floor(remainingMs / 60_000);
  if (totalMinutes < 1) return '<1min';
  if (totalMinutes < 60) return `${totalMinutes}min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`;
}

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
 * Attaches geometry to an alert's departments from the (lazily-fetched) shown
 * departments list, so each item can be clicked to fly the map to it.
 */
export function withDepartmentGeometries(
  departments: ReadonlyArray<ActiveAlertDepartment>,
  shownDepartments: ReadonlyArray<Department>,
): ReadonlyArray<DepartmentListItem> {
  if (shownDepartments.length === 0) return departments;

  const geometryByName = new Map(shownDepartments.map((d) => [d.name, d.geometry]));
  return departments.map((dept) => ({ ...dept, geometry: geometryByName.get(dept.name) }));
}

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

export function toPendingAlert(res: PendingAlertResponse, baseUrl: string): PendingAlert {
  return {
    alertId: res.alert_id,
    phenomenon: res.phenomenon,
    departments: parseAffectedDepartments(res.area),
    coordinates: parseActiveAlertPolygon(res.polygon),
    gifGralUrl: `${baseUrl}${res.gif_gral_url}`,
    gifAreaUrl: `${baseUrl}${res.gif_area_url}`,
  };
}
