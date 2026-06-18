import { environment } from '../../environments/environment';

/**
 * URLs del API de métricas del alerts-service (panel "Alertas" del estado).
 * Devuelven la ruta base; los parámetros de query los agrega el servicio con
 * `HttpParams`. La base es la del alerts-service (no la del data-service).
 */
const ALERTS_METRICS_BASE_URL = `${environment.alertsService.baseUrl}/metrics`;

/** KPIs del panel: agregados de trabajos + último snapshot del procesador. */
export function buildAlertsSummaryUrl(): string {
  return `${ALERTS_METRICS_BASE_URL}/summary`;
}

/** Trabajos de generación de avisos recientes (terminal: done/failed). */
export function buildAlertsJobsUrl(): string {
  return `${ALERTS_METRICS_BASE_URL}/jobs`;
}

/** Conteos done/failed y duración promedio por intervalo de tiempo. */
export function buildAlertsJobsHistoryUrl(): string {
  return `${ALERTS_METRICS_BASE_URL}/jobs/history`;
}

/** Serie temporal de salud del procesador (cola, workers, pendientes). */
export function buildAlertsProcessorHistoryUrl(): string {
  return `${ALERTS_METRICS_BASE_URL}/processor/history`;
}

/** Corridas recientes del refresco de capas geográficas (scheduler). */
export function buildAlertsLayersUrl(): string {
  return `${ALERTS_METRICS_BASE_URL}/layers`;
}

/** URL pública de un GIF de aviso (montaje estático `/alerts/{filename}`). */
export function buildAlertImageUrl(filename: string): string {
  return `${environment.alertsService.baseUrl}/alerts/${filename}`;
}
