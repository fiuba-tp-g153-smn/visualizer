/**
 * Fábricas de celdas específicas de métricas (barra de etapas y píldoras de
 * resultado), compartidas por las tablas de resumen y de trabajos recientes.
 */
import type { JobOutcome, OutcomeCounts, StageTimings } from '../../models/metrics/metrics.models';
import { stageColor } from '../../services/metrics/metrics-chart.util';
import { secs } from '../../services/metrics/metrics-format.util';
import { outcomeLabel, stageLabel } from '../../services/metrics/metrics-labels.constants';
import { barCell, pillsCell, type Cell } from './sortable-table/sortable-table.models';

const OUTCOME_ORDER: readonly JobOutcome[] = ['success', 'error', 'dlq', 'requeued', 'skipped'];

/** Suma de los segundos de todas las etapas. */
export function stageTotal(stages: StageTimings): number {
  return Object.values(stages ?? {}).reduce((sum, value) => sum + value, 0);
}

/** Barra apilada del desglose por etapa, con leyenda en español. */
export function stageBarCell(stages: StageTimings): Cell {
  const entries = Object.entries(stages ?? {});
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    return barCell([], '');
  }
  const segments = entries.map(([name, value]) => ({
    color: stageColor(name),
    widthPct: (value / total) * 100,
    title: `${stageLabel(name)}: ${secs(value)}`,
  }));
  return barCell(segments, stageLegend(stages));
}

/** Leyenda textual del desglose por etapa (usada también en "detalle"). */
export function stageLegend(stages: StageTimings): string {
  return Object.entries(stages ?? {})
    .map(([name, value]) => `${stageLabel(name)} ${secs(value)}`)
    .join(' · ');
}

/** Píldoras de conteo por resultado (solo las que tienen al menos un trabajo). */
export function outcomePillsCell(counts: OutcomeCounts): Cell {
  const items = OUTCOME_ORDER.filter((outcome) => counts[outcome] > 0).map((outcome) => ({
    outcome,
    label: outcomeLabel(outcome),
    count: counts[outcome],
  }));
  return pillsCell(items);
}
