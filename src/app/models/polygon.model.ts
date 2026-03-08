/**
 * Representa un departamento con sus geometrías
 */
export interface PolygonDepartment {
  properties: {
    [key: string]: any;
  };
  geometry: GeoJSON.Geometry;
  intersection: GeoJSON.Geometry;
}

/**
 * Representa un polígono en el mapa
 */
export interface Polygon {
  /**
   * Identificador único del polígono
   */
  id: string;

  /**
   * Nombre descriptivo del polígono
   */
  name: string;

  /**
   * Coordenadas del polígono [lat, lng][]
   */
  coordinates: Array<[number, number]>;

  /**
   * Color del polígono en formato hex
   */
  color: string;

  /**
   * Indica si el polígono está visible en el mapa
   */
  visible: boolean;

  /**
   * Fecha de creación
   */
  createdAt: Date;

  /**
   * Fecha de última modificación
   */
  updatedAt: Date;

  /**
   * Departamentos que intersectan con el polígono
   */
  departments?: PolygonDepartment[];

  /**
   * Indica si los departamentos están visibles
   */
  departmentsVisible?: boolean;

  /**
   * Coordenadas originales antes de recortar (para deshacer)
   */
  originalCoordinates?: Array<[number, number]>;
}

/**
 * DTO para crear un nuevo polígono
 */
export interface CreatePolygonDto {
  name: string;
  coordinates: Array<[number, number]>;
  color?: string;
}

/**
 * DTO para actualizar un polígono existente
 */
export interface UpdatePolygonDto {
  name?: string;
  coordinates?: Array<[number, number]>;
  color?: string;
  visible?: boolean;
  departments?: PolygonDepartment[];
  departmentsVisible?: boolean;
  originalCoordinates?: Array<[number, number]>;
}
