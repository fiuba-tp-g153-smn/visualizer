import type { Geometry } from 'geojson';

/**
 * Representa un departamento con sus geometrías
 */
export interface Department {
  name: string;
  province: string;
  geometry: Geometry;
  intersection: Geometry;
}

/**
 * Respuesta del endpoint de departamentos
 */
export interface DepartmentsResponse {
  departments: Department[];
}

/**
 * Identifies a single department for hover/highlight matching. Name alone is
 * ambiguous — many department names repeat across provinces (e.g. "General
 * San Martín") — so province must travel alongside it everywhere a department
 * is referenced by hover. Use an empty string, not undefined, when the
 * province is genuinely unknown.
 */
export interface DepartmentRef {
  name: string;
  province: string;
}
