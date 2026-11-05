import { METRICS_TEXTS } from '../../texts';

export const OUTCOME_LABELS: Readonly<Record<string, string>> = METRICS_TEXTS.outcomes;

// Colores por resultado, alineados con las píldoras `.pill--*` de la tabla
// (sortable-table.component.scss). Fuente única para las barras de la línea de
// tiempo y su leyenda.
export const OUTCOME_COLORS: Readonly<Record<string, string>> = {
  success: '#2e9b51',
  error: '#e8702a',
  dlq: '#d23b4e',
  requeued: '#b5892a',
  skipped: '#6b7280',
};

const FALLBACK_OUTCOME_COLOR = '#8e8e8e';

export const STAGE_LABELS: Readonly<Record<string, string>> = METRICS_TEXTS.stages;

export const PRODUCT_TERMS: Readonly<Record<string, string>> = METRICS_TEXTS.productTerms;

export function prod(label: string | null | undefined): string {
  let text = label ?? '';
  for (const [en, es] of Object.entries(PRODUCT_TERMS)) {
    text = text.split(en).join(es);
  }
  return text;
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome;
}

export function outcomeColor(outcome: string): string {
  return OUTCOME_COLORS[outcome] ?? FALLBACK_OUTCOME_COLOR;
}
