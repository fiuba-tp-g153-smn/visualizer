import { Department } from './department.model';
import { LatLng } from './coordinate.model';
import { PolygonStatus } from '../../constants';

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
   * Número de borrador asignado al crear el polígono
   */
  draftNumber: number;

  /**
   * Coordenadas del polígono [lat, lng][]
   */
  coordinates: Array<LatLng>;

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
  departments?: Department[];

  /**
   * Indica si los departamentos están visibles
   */
  departmentsVisible?: boolean;

  /**
   * Coordenadas originales antes de recortar (para deshacer)
   */
  originalCoordinates?: Array<LatLng>;

  /**
   * Estado transitorio del polígono (p. ej. generación de aviso en curso).
   * Ausente para un borrador normal y editable.
   */
  status?: PolygonStatus;
}

/**
 * DTO para crear un nuevo polígono
 */
export interface CreatePolygonDto {
  name: string;
  coordinates: Array<LatLng>;
}

/**
 * DTO para actualizar un polígono existente
 */
export interface UpdatePolygonDto {
  name?: string;
  coordinates?: Array<LatLng>;
  visible?: boolean;
  departments?: Department[];
  departmentsVisible?: boolean;
  originalCoordinates?: Array<LatLng>;
  status?: PolygonStatus;
}
