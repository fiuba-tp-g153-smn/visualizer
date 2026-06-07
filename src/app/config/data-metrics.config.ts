import { environment } from '../../environments/environment';

/**
 * URLs del API de métricas del data-service (panel de estado y memoria). Las
 * métricas viven dentro del mismo data-service bajo `/metrics`, así que
 * reutilizamos `dataService.baseUrl` (no hace falta una variable de entorno
 * nueva). Los parámetros de query los agrega el servicio con `HttpParams`.
 */
const DATA_METRICS_BASE_URL = `${environment.dataService.baseUrl.replace(/\/+$/, '')}/metrics`;

/** KPIs de cabecera (memoria Redis + salud de sync). */
export function buildDataSummaryUrl(): string {
  return `${DATA_METRICS_BASE_URL}/summary`;
}

/** Estado por dominio + banderas del loop combinado. */
export function buildDataSyncStatusUrl(): string {
  return `${DATA_METRICS_BASE_URL}/sync/status`;
}

/** Serie temporal de throughput/errores de sync por dominio. */
export function buildDataSyncHistoryUrl(): string {
  return `${DATA_METRICS_BASE_URL}/sync/history`;
}

/** Ciclos de sync recientes (tabla). */
export function buildDataSyncCyclesUrl(): string {
  return `${DATA_METRICS_BASE_URL}/sync/cycles`;
}

/** Desglose de memoria Redis por dominio (última muestra). */
export function buildDataRedisMemoryUrl(): string {
  return `${DATA_METRICS_BASE_URL}/redis/memory`;
}

/** Serie temporal de memoria Redis por dominio (crecimiento). */
export function buildDataRedisMemoryHistoryUrl(): string {
  return `${DATA_METRICS_BASE_URL}/redis/memory/history`;
}

/** Snapshot de Redis INFO (`?live=true` consulta Redis en el momento). */
export function buildDataRedisInfoUrl(): string {
  return `${DATA_METRICS_BASE_URL}/redis/info`;
}

/** Serie temporal de Redis INFO (used_memory, fragmentación, ...). */
export function buildDataRedisInfoHistoryUrl(): string {
  return `${DATA_METRICS_BASE_URL}/redis/info/history`;
}

/** Estado por provider del scraper de basemap (cursor, completado, circuito). */
export function buildDataBasemapProvidersUrl(): string {
  return `${DATA_METRICS_BASE_URL}/basemap/providers`;
}
