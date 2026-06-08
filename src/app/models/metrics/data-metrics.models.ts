/**
 * Tipos del panel de estado/rendimiento del data-service. Reflejan 1:1 los
 * modelos Pydantic de `data-service/src/models/metrics.py` (snake_case para
 * mapear el JSON directo). Distintos de `metrics.models.ts`, que pertenece al
 * dashboard del tiles-processor.
 */

export type SyncBucket = 'hour' | 'day';

/** Último ciclo de un dominio de sync (su estado en vivo). */
export interface DataSyncDomainStatus {
  domain: string;
  last_started: string | null;
  last_finished: string | null;
  last_duration_ms: number | null;
  last_downloaded: number | null;
  last_errors: number | null;
  outcome: string | null;
}

/** Estado por dominio + banderas del loop combinado (sat/radar/ecmwf/wrf). */
export interface DataSyncStatus {
  is_running: boolean;
  total_cycles: number;
  consecutive_failures: number;
  last_sync_start: number | null;
  last_sync_end: number | null;
  domains: DataSyncDomainStatus[];
}

/** Un punto agregado (bucket temporal, dominio) para las series de sync. */
export interface DataSyncHistoryPoint {
  bucket: string;
  domain: string;
  cycles: number;
  downloaded: number;
  errors: number;
  avg_duration_ms: number;
}

/** Una fila de ciclo de sync registrada (tabla de ciclos recientes). */
export interface DataSyncCycle {
  domain: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  downloaded: number;
  errors: number;
  outcome: string;
}

/** Uso de memoria Redis de un dominio en la última muestra. */
export interface RedisMemoryDomain {
  domain: string;
  key_count: number;
  memory_bytes: number;
}

/** Desglose de memoria Redis por dominio (última muestra). */
export interface RedisMemoryResponse {
  sampled_at: string | null;
  total_keys: number;
  total_bytes: number;
  domains: RedisMemoryDomain[];
}

/** Un punto (timestamp, dominio) de la serie de crecimiento de memoria. */
export interface RedisMemoryHistoryPoint {
  sampled_at: string;
  domain: string;
  key_count: number;
  memory_bytes: number;
}

/** Snapshot de las estadísticas globales de Redis INFO. */
export interface RedisInfo {
  sampled_at: string | null;
  used_memory: number | null;
  used_memory_rss: number | null;
  used_memory_peak: number | null;
  maxmemory: number | null;
  mem_fragmentation_ratio: number | null;
  evicted_keys: number | null;
  expired_keys: number | null;
  keyspace_hits: number | null;
  keyspace_misses: number | null;
  connected_clients: number | null;
  total_keys: number | null;
}

/** Progreso del scraper de basemap + estado del circuit breaker por provider. */
export interface BasemapProviderStatus {
  provider_id: string;
  name: string;
  min_zoom: number;
  max_zoom: number;
  in_progress: boolean;
  cursor_zoom: number | null;
  cursor_tile_index: number | null;
  last_completed: number | null;
  circuit_open: boolean;
  consecutive_trips: number;
  cooldown_until: number | null;
  last_reason: string | null;
  // Último barrido: attempted = ok + failed; error_rate = failed / attempted.
  attempted: number;
  ok: number;
  failed: number;
  error_rate: number | null;
  completed: boolean;
  last_swept: number | null;
}

/** KPIs de cabecera del dashboard. */
export interface DataMetricsSummary {
  sampled_at: string | null;
  used_memory: number | null;
  used_memory_rss: number | null;
  maxmemory: number | null;
  total_keys: number;
  total_bytes: number;
  top_domain: string | null;
  top_domain_bytes: number;
  sync_is_running: boolean;
  sync_total_cycles: number;
  sync_consecutive_failures: number;
  active_sync_domains: number;
  last_sync_finished: string | null;
}
