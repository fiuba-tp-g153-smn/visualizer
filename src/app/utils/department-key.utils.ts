import { DepartmentRef } from '../models/geo';

/** Normalizes text for matching (lowercase, trimmed, accent-free). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .trim()
    .toLowerCase();
}

/**
 * Composite key for a department. Name alone collides across provinces
 * (e.g. "General San Martín" exists in several), so layer maps keyed only by
 * name either render/highlight the wrong department or drop one silently.
 */
export function departmentKey(ref: DepartmentRef): string {
  return `${normalize(ref.name)}|${normalize(ref.province)}`;
}
