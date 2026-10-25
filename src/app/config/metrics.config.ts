import { environment } from '../../environments/environment';

/**
 * URLs del API de métricas del tiles-processor (panel de rendimiento backoffice).
 * Devuelven la ruta base; los parámetros de query los agrega el servicio con
 * `HttpParams`. La base se inyecta vía `METRICS_SERVICE_BASE_URL`.
 */
const METRICS_SERVICE_BASE_URL = environment.metricsService.baseUrl;

/** Estadísticas agregadas por tipo de trabajo. */
export function buildSummaryUrl(): string {
  return `${METRICS_SERVICE_BASE_URL}/api/summary`;
}

/** Trabajos finalizados recientes (paginado, con filtros opcionales). */
export function buildJobsUrl(): string {
  return `${METRICS_SERVICE_BASE_URL}/api/jobs`;
}

/** Un trabajo finalizado completo, por id (detalle desde la línea de tiempo). */
export function buildJobUrl(id: number): string {
  return `${METRICS_SERVICE_BASE_URL}/api/jobs/${id}`;
}

/** Trabajos de una ventana en forma columnar compacta (línea de tiempo). */
export function buildTimelineUrl(): string {
  return `${METRICS_SERVICE_BASE_URL}/api/timeline`;
}

/** Conteo de trabajos por intervalo de tiempo y tipo. */
export function buildThroughputUrl(): string {
  return `${METRICS_SERVICE_BASE_URL}/api/throughput`;
}

/** Series temporales de tiempos (prom/p95/etapas) por intervalo y tipo. */
export function buildTimeSeriesUrl(): string {
  return `${METRICS_SERVICE_BASE_URL}/api/timeseries`;
}

/** Estado en vivo: profundidad de colas y trabajos en proceso. */
export function buildLiveUrl(): string {
  return `${METRICS_SERVICE_BASE_URL}/api/live`;
}
