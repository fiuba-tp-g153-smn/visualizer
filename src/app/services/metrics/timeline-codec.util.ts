import type { RecentJob, TimelinePayload } from '../../models/metrics/metrics.models';

/**
 * Decodifica la respuesta columnar de `GET /api/timeline` a la forma `RecentJob`
 * que consume la línea de tiempo compartida. Sólo vienen los campos que el
 * gráfico usa (inicio/fin, resultado→color, tipo/etiqueta, worker); el resto
 * queda en valores neutros, igual que en las demás adaptaciones a `RecentJob`.
 * `total_s` sale de la duración (el backend no lo envía: coincide con fin − inicio).
 * El detalle completo de un trabajo se pide por id al hacer clic.
 */
export function decodeTimeline(payload: TimelinePayload): RecentJob[] {
  const jobs: RecentJob[] = [];
  let id = 0;
  let startMs = payload.t0 ?? 0;
  for (let i = 0; i < payload.id.length; i++) {
    id += payload.id[i];
    startMs += payload.start[i];
    jobs.push(toRecentJob(payload, i, id, startMs));
  }
  return jobs;
}

function toRecentJob(payload: TimelinePayload, i: number, id: number, startMs: number): RecentJob {
  const type = payload.type[i];
  const durMs = payload.dur[i];
  return {
    id,
    work_unit_id: null,
    image_id: '',
    data_source_id: '',
    processor_id: null,
    band_id: null,
    job_type: payload.types[type],
    product_label: payload.labels[type],
    image_timestamp: null,
    outcome: payload.outcomes[payload.outcome[i]],
    worker_host: payload.workers[payload.worker[i]],
    started_at: new Date(startMs).toISOString(),
    finished_at: new Date(startMs + durMs).toISOString(),
    retry_count: 0,
    error_message: null,
    download_s: null,
    process_s: null,
    total_s: durMs / 1000,
    stage_timings: {},
  };
}
