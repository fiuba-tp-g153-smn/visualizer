/**
 * Tipos del API de métricas del alerts-service. Reflejan 1:1 la forma de las
 * respuestas JSON (snake_case, igual que el backend).
 */

/** Agregado de trabajos de generación en la ventana seleccionada. */
export interface AlertsJobsAggregate {
  readonly total: number;
  readonly done: number;
  readonly failed: number;
  /** Conteo de fallos por `error_code` (timeout, area_too_large, …). */
  readonly failure_breakdown: Readonly<Record<string, number>>;
  readonly avg_duration_ms: number;
  readonly p95_duration_ms: number;
  readonly avg_intersection_ms: number;
  readonly avg_render_ms: number;
}

/** Último snapshot del procesador de trabajos en segundo plano. */
export interface AlertsProcessorStats {
  readonly sampled_at: string | null;
  readonly queue_depth: number;
  readonly workers: number;
  readonly respawns: number;
  readonly jobs_queued_total: number;
  readonly jobs_done_total: number;
  readonly jobs_failed_total: number;
  readonly pending_alerts: number;
}

/** Respuesta de `GET /metrics/summary`. */
export interface AlertsSummary {
  readonly window_hours: number;
  readonly jobs: AlertsJobsAggregate;
  readonly processor: AlertsProcessorStats;
}

/** Un trabajo terminal (`GET /metrics/jobs`). */
export interface AlertJobMetric {
  readonly job_id: string;
  readonly phenomenon_code: number;
  readonly finished_at: string;
  readonly duration_ms: number;
  readonly outcome: 'done' | 'failed';
  readonly error_code: string | null;
  readonly affected_departments: number | null;
  readonly intersection_ms: number | null;
  readonly render_ms: number | null;
  readonly polygon_vertices: number | null;
}

/** Un bucket de `GET /metrics/jobs/history`. */
export interface AlertsJobHistoryPoint {
  readonly bucket: string;
  readonly done: number;
  readonly failed: number;
  readonly avg_duration_ms: number;
}

/** Un snapshot de `GET /metrics/processor/history`. */
export interface AlertsProcessorSample {
  readonly sampled_at: string;
  readonly queue_depth: number;
  readonly workers: number;
  readonly respawns: number;
  readonly jobs_queued_total: number;
  readonly jobs_done_total: number;
  readonly jobs_failed_total: number;
  readonly pending_alerts: number;
}

/** Una corrida de refresco de capas (`GET /metrics/layers`). */
export interface AlertsLayerRun {
  readonly run_at: string | null;
  readonly status: string;
  readonly files: ReadonlyArray<string>;
  readonly duration_sec: number | null;
  readonly error: string | null;
}

// ── Tipos de los controles del panel ──────────────────────────────────────

/** Ventana temporal: todo / 24 h / 7 d (en horas; 0 = todo). */
export type WindowHours = 0 | 24 | 168;
/** Cadencia de auto-refresco en segundos (0 = desactivado). */
export type RefreshSeconds = 0 | 10 | 30 | 60;
