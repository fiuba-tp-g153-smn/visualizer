import type { Geometry } from 'geojson';

/**
 * Representa un departamento con sus geometrías
 */
export interface Department {
  name: string;
  geometry: Geometry;
  intersection: Geometry;
}

/**
 * Respuesta del endpoint de departamentos
 */
export interface DepartmentsResponse {
  departments: Department[];
}
