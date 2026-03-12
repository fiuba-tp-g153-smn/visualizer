/**
 * Representa un departamento con sus geometrías
 */
export interface Department {
  name: string;
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

/**
 * Respuesta del endpoint de departamentos
 */
export interface DepartmentsResponse {
  departments: Department[];
}
