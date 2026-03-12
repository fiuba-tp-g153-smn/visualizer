import { environment } from '../../environments/environment';

/**
 * Configuración del servicio de alertas basada en variables de entorno
 */
const ALERTS_SERVICE_BASE_URL = environment.alertsService.baseUrl;

/**
 * Construye URL para el endpoint de intersección con el país
 */
export function buildIntersectCountryUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/intersect/country`;
}

/**
 * Construye URL para el endpoint de intersección con departamentos
 */
export function buildIntersectDepartmentsUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/intersect/departments`;
}
