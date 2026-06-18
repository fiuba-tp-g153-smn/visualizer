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

/**
 * Construye URL para el endpoint de generación de alertas
 */
export function buildGenerateAlertsUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/alerts`;
}

/**
 * Construye URL para consultar el estado de un trabajo de generación de aviso
 * (`GET /alerts/jobs/{jobId}`).
 */
export function buildAlertJobUrl(jobId: string): string {
  return `${ALERTS_SERVICE_BASE_URL}/alerts/jobs/${encodeURIComponent(jobId)}`;
}

/**
 * Construye URL para el endpoint de fenómenos disponibles
 */
export function buildPhenomenaUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/alerts/phenomena`;
}

/**
 * Construye URL para el endpoint de listado de avisos activos
 */
export function buildAlertsUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/alerts`;
}

/**
 * Construye URL para el endpoint de listado de avisos pendientes
 */
export function buildPendingAlertsUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/alerts/pending`;
}

/**
 * Construye URL para el endpoint de límites de generación de avisos
 * (incluye `max_vertex_count`, la cantidad máxima de vértices por polígono)
 */
export function buildAlertsLimitsUrl(): string {
  return `${ALERTS_SERVICE_BASE_URL}/alerts/limits`;
}
