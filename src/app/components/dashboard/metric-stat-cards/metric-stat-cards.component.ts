import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { JobTypeSummary } from '../../../models/metrics/metrics.models';
import { pct } from '../../../services/metrics/metrics-format.util';

type Accent = '' | 'orange' | 'red';

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly accent: Accent;
}

/** Tarjetas del "Resumen general": totales de la ventana seleccionada. */
@Component({
  selector: 'app-metric-stat-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cards">
      @for (card of cards(); track card.label) {
        <div class="card">
          <div class="card__label">{{ card.label }}</div>
          <div
            class="card__value"
            [class.card__value--orange]="card.accent === 'orange'"
            [class.card__value--red]="card.accent === 'red'"
          >
            {{ card.value }}
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './metric-stat-cards.component.scss',
})
export class MetricStatCardsComponent {
  readonly summary = input.required<readonly JobTypeSummary[]>();

  readonly cards = computed<StatCard[]>(() => {
    const totals = { total: 0, success: 0, error: 0, dlq: 0, requeued: 0, skipped: 0 };
    for (const entry of this.summary()) {
      totals.total += entry.counts.total;
      totals.success += entry.counts.success;
      totals.error += entry.counts.error;
      totals.dlq += entry.counts.dlq;
      totals.requeued += entry.counts.requeued;
      totals.skipped += entry.counts.skipped;
    }
    const failures = totals.error + totals.dlq;
    const successRate = totals.total ? totals.success / totals.total : null;
    return [
      { label: 'Trabajos', value: String(totals.total), accent: '' },
      { label: 'Tasa de éxito', value: totals.total ? pct(successRate) : '—', accent: '' },
      { label: 'Fallos', value: String(failures), accent: failures > 0 ? 'orange' : '' },
      { label: 'Descartes (DLQ)', value: String(totals.dlq), accent: totals.dlq > 0 ? 'red' : '' },
      { label: 'Reencolados', value: String(totals.requeued), accent: '' },
      { label: 'Omitidos', value: String(totals.skipped), accent: '' },
      { label: 'Tipos', value: String(this.summary().length), accent: '' },
    ];
  });
}
