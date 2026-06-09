import type { RecentJob } from '../../models/metrics/metrics.models';
import { buildTypeColorMap } from './metrics-chart.util';
import { secs } from './metrics-format.util';
import { outcomeColor, outcomeLabel, prod } from './metrics-labels.constants';

export type TimelineColorBy = 'outcome' | 'type';

/** Entrada de la leyenda (chip de color + etiqueta). */
export interface LegendItem {
  readonly label: string;
  readonly color: string;
}

const OUTCOME_ORDER = ['success', 'error', 'dlq', 'requeued', 'skipped'];

/** Leyenda según el modo de color: por resultado (orden fijo) o por tipo. */
export function legendItems(
  jobs: readonly RecentJob[],
  colorBy: TimelineColorBy,
): readonly LegendItem[] {
  if (colorBy === 'type') {
    const labelByType = new Map<string, string>();
    for (const job of jobs) {
      if (!labelByType.has(job.job_type)) {
        labelByType.set(job.job_type, prod(job.product_label ?? job.job_type));
      }
    }
    const types = [...labelByType.keys()].sort();
    const colorFor = buildTypeColorMap(types);
    return types.map((type) => ({ label: labelByType.get(type) ?? type, color: colorFor(type) }));
  }
  const present = new Set(jobs.map((job) => job.outcome));
  return OUTCOME_ORDER.filter((outcome) => present.has(outcome as RecentJob['outcome'])).map(
    (outcome) => ({ label: outcomeLabel(outcome), color: outcomeColor(outcome) }),
  );
}

export const UNKNOWN_WORKER = 'desconocido';
/** Alto por carril (px) para dimensionar el contenedor del gráfico. */
export const ROW_HEIGHT = 26;

/** Una unidad ya empaquetada en un carril (fila) para que no se solape. */
export interface LaneRow {
  readonly job: RecentJob;
  readonly lane: number; // índice de fila (0..N-1)
  readonly start: number; // epoch ms
  readonly end: number; // epoch ms
}

/**
 * Empaquetado de intervalos (greedy): ordena por inicio y asigna a cada unidad
 * el primer carril cuyo último trabajo ya terminó (fin <= inicio), o abre uno
 * nuevo. El número de carriles resultante es la concurrencia máxima, así que no
 * crece al mirar más atrás — solo evita que las barras se solapen en el tiempo.
 */
export function packIntoLanes(jobs: readonly RecentJob[]): { rows: LaneRow[]; lanes: number } {
  const ordered = [...jobs].sort((a, b) => {
    const byStart = a.started_at.localeCompare(b.started_at);
    return byStart !== 0 ? byStart : a.finished_at.localeCompare(b.finished_at);
  });
  const laneEnds: number[] = [];
  const rows: LaneRow[] = ordered.map((job) => {
    const start = new Date(job.started_at).getTime();
    const end = new Date(job.finished_at).getTime();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { job, lane, start, end };
  });
  return { rows, lanes: laneEnds.length };
}

/** Nombre de contenedor de un worker: `worker1`, `worker2`, `worker-light1`, … */
const WORKER_NAME_RE = /^worker(-light)?\d+$/;

/** Layout de la línea de tiempo: filas, nº de carriles, etiquetas y modo. */
export interface TimelineLayout {
  readonly rows: LaneRow[];
  readonly lanes: number;
  readonly laneLabels: string[];
  /** `true` si los carriles son por worker; `false` si por solape (datos viejos). */
  readonly grouped: boolean;
}

/**
 * ¿Se puede agrupar por worker? Sólo si **todos** los trabajos visibles traen un
 * `worker_host` con formato de contenedor (`worker1`, `worker-light1`, …). Datos
 * viejos (host con hash o nulo) o mixtos → `false`, y se cae al empaquetado por
 * solape, preservando el render actual.
 */
export function canGroupByWorker(jobs: readonly RecentJob[]): boolean {
  return (
    jobs.length > 0 &&
    jobs.every((job) => job.worker_host != null && WORKER_NAME_RE.test(job.worker_host))
  );
}

/** Orden de carriles: workers generales antes que los light, luego por número. */
function workerSortKey(name: string): [number, number] {
  const match = /^worker(-light)?(\d+)$/.exec(name);
  return match ? [match[1] ? 1 : 0, Number(match[2])] : [2, 0];
}

/**
 * Un carril por worker (contenedor), ordenados general→light y por número. Dentro
 * de un worker los trabajos comparten carril: con prefetch=1 cada worker procesa
 * uno por vez, así que no se solapan en el tiempo.
 */
export function packByWorker(jobs: readonly RecentJob[]): {
  rows: LaneRow[];
  lanes: number;
  laneLabels: string[];
} {
  const workers = [...new Set(jobs.map((job) => job.worker_host as string))].sort((a, b) => {
    const [ga, na] = workerSortKey(a);
    const [gb, nb] = workerSortKey(b);
    return ga - gb || na - nb || a.localeCompare(b);
  });
  const laneOf = new Map(workers.map((worker, index) => [worker, index]));
  const rows: LaneRow[] = jobs.map((job) => ({
    job,
    lane: laneOf.get(job.worker_host as string) ?? 0,
    start: new Date(job.started_at).getTime(),
    end: new Date(job.finished_at).getTime(),
  }));
  return { rows, lanes: workers.length, laneLabels: workers };
}

/**
 * Distribuye los trabajos en carriles: por worker (contenedor) cuando los datos
 * lo permiten, o por solape como antes para datos viejos/mixtos. `laneLabels` son
 * nombres de worker (modo agrupado) o números `1..N` (modo solape).
 */
export function layoutTimeline(jobs: readonly RecentJob[]): TimelineLayout {
  if (canGroupByWorker(jobs)) {
    return { ...packByWorker(jobs), grouped: true };
  }
  const { rows, lanes } = packIntoLanes(jobs);
  const laneLabels = Array.from({ length: Math.max(lanes, 1) }, (_, i) => String(i + 1));
  return { rows, lanes, laneLabels, grouped: false };
}

/** Color de una unidad: por resultado o por tipo de trabajo. */
export function colorOf(
  job: RecentJob,
  colorBy: TimelineColorBy,
  typeColorFor: (type: string) => string,
): string {
  return colorBy === 'type' ? typeColorFor(job.job_type) : outcomeColor(job.outcome);
}

function workerLabel(job: RecentJob): string {
  return job.worker_host ?? UNKNOWN_WORKER;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Día y mes (epoch ms) como `DD/MM` (sin año), en UTC o en hora local del
 * navegador según `utc` (`getUTC*` vs `get*`). Se muestra en negrita para
 * distinguir la fecha de una hora "suelta" (`HH:mm`).
 */
export function fmtDate(ms: number, utc: boolean): string {
  const d = new Date(ms);
  const day = utc ? d.getUTCDate() : d.getDate();
  const mo = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
  return `${pad(day)}/${pad(mo)}`;
}

/** Hora y minuto (epoch ms) como `HH:mm`, en UTC o local según `utc`. */
export function fmtTime(ms: number, utc: boolean): string {
  const d = new Date(ms);
  const h = utc ? d.getUTCHours() : d.getHours();
  const m = utc ? d.getUTCMinutes() : d.getMinutes();
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Instante compacto `DD/MM HH:mm`, en UTC o local según `utc`. Refleja el estilo
 * del eje (`{dd}/{MM} {HH}:{mm}`); se usa en el `labelFormatter` del slider, donde
 * la etiqueta es texto plano y no admite negrita parcial.
 */
export function fmtDateTime(ms: number, utc: boolean): string {
  return `${fmtDate(ms, utc)} ${fmtTime(ms, utc)}`;
}

function clock(iso: string, utc: boolean): string {
  const d = new Date(iso);
  const h = utc ? d.getUTCHours() : d.getHours();
  const m = utc ? d.getUTCMinutes() : d.getMinutes();
  const s = utc ? d.getUTCSeconds() : d.getSeconds();
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tipRow(name: string, value: string): string {
  return `<div class="apx-tip__row"><span class="apx-tip__name">${name}</span><span class="apx-tip__val">${value}</span></div>`;
}

/**
 * HTML del tooltip, compartido por ambos motores (reutiliza las clases
 * `.apx-tip*` globales de `styles.scss`). Muestra producto, worker, inicio/fin
 * (en UTC o local según `utc`), duración y resultado.
 */
export function tooltipHtml(job: RecentJob, utc: boolean): string {
  return [
    '<div class="apx-tip">',
    `<div class="apx-tip__title">${escapeHtml(prod(job.product_label ?? job.job_type))}</div>`,
    tipRow('Worker', escapeHtml(workerLabel(job))),
    tipRow('Inicio', clock(job.started_at, utc)),
    tipRow('Fin', clock(job.finished_at, utc)),
    tipRow('Duración', secs(job.total_s)),
    tipRow('Resultado', outcomeLabel(job.outcome)),
    '</div>',
  ].join('');
}
