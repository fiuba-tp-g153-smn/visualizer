/**
 * Representa un departamento con sus geometrías
 */
export interface Department {
  properties: Record<string, any>;
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

/**
 * Respuesta del endpoint de departamentos
 */
export interface DepartmentsResponse {
  departments: Department[];
}
