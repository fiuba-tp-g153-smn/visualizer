/**
 * Tipos del API de métricas del tiles-processor. Reflejan 1:1 la forma de las
 * respuestas JSON (snake_case, igual que el backend), por lo que el front no
 * necesita una capa de adaptación.
 */

/** Disposición terminal de un trabajo procesado. */
export type JobOutcome = 'success' | 'error' | 'dlq' | 'requeued' | 'skipped';

/** Estadísticas avg/min/max/p95 (null cuando no hay muestras). */
export interface StatBlock {
  readonly avg: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly p95: number | null;
}

/** Duraciones promedio por etapa del pipeline, en segundos. */
export type StageTimings = Readonly<Record<string, number>>;

/** Conteos por resultado para un tipo de trabajo. */
export interface OutcomeCounts {
  readonly success: number;
  readonly error: number;
  readonly dlq: number;
  readonly requeued: number;
  readonly skipped: number;
  readonly total: number;
}

/** Estadísticas agregadas de un tipo de trabajo (`GET /api/summary`). */
export interface JobTypeSummary {
  readonly job_type: string;
  readonly product_label: string | null;
  readonly counts: OutcomeCounts;
  readonly error_rate: number;
  readonly last_finished: string;
  readonly total_s: StatBlock;
  readonly download_s: StatBlock;
  readonly process_s: StatBlock;
  readonly stages: StageTimings;
}

/** Un trabajo finalizado (`GET /api/jobs`). */
export interface RecentJob {
  readonly id: number;
  readonly work_unit_id: string | null;
  readonly image_id: string;
  readonly data_source_id: string;
  readonly processor_id: string | null;
  readonly band_id: string | null;
  readonly job_type: string;
  readonly product_label: string | null;
  readonly image_timestamp: string | null;
  readonly outcome: JobOutcome;
  readonly worker_host: string | null;
  readonly started_at: string;
  readonly finished_at: string;
  readonly retry_count: number;
  readonly error_message: string | null;
  readonly download_s: number | null;
  readonly process_s: number | null;
  readonly total_s: number | null;
  readonly stage_timings: StageTimings;
}

/** Conteo de trabajos por intervalo y tipo (`GET /api/throughput`). */
export interface ThroughputBucket {
  readonly bucket: string;
  readonly job_type: string;
  readonly count: number;
}

/** Tiempos por intervalo y tipo (`GET /api/timeseries`). */
export interface TimingSeriesPoint {
  readonly bucket: string;
  readonly job_type: string;
  readonly count: number;
  readonly avg_total_s: number | null;
  readonly p95_total_s: number | null;
  readonly stages: StageTimings;
}

/** Un trabajo en proceso ahora mismo (rastreador de progreso). */
export interface InProgressJob {
  readonly image_id: string;
  readonly band_id: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Profundidad de colas de RabbitMQ (null si no responde). */
export interface QueueDepths {
  readonly work: number | null;
  readonly dlq: number | null;
}

/** Estado en vivo (`GET /api/live`). */
export interface LiveStatus {
  readonly queues: QueueDepths;
  readonly in_progress: readonly InProgressJob[];
}

// ── Tipos de los controles del panel ──────────────────────────────────────

/** Ventana temporal global: todo / 24 h / 7 d (en horas; 0 = todo). */
export type WindowHours = 0 | 24 | 168;
/** Intervalo de agrupación de las tendencias. */
export type Bucket = 'hour' | 'day';
/** Cadencia de auto-refresco en segundos (0 = desactivado). */
export type RefreshSeconds = 0 | 10 | 30 | 60;
/** Rango de la vista de throughput de 10 min (en horas). */
export type TenMinWindowHours = 1 | 3 | 6 | 12;
/** Rango de la línea de tiempo de unidades (en horas; 0 = todo el histórico). */
export type TimelineWindowHours = 0 | 6 | 12 | 24 | 48 | 72 | 168;
