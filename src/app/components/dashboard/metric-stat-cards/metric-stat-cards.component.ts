import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { JobTypeSummary } from '../../../models/metrics/metrics.models';
import { pct } from '../../../services/metrics/metrics-format.util';
import { prod } from '../../../services/metrics/metrics-labels.constants';
import { DASHBOARDS_TEXTS } from '../../../texts';

type Accent = '' | 'green' | 'orange' | 'red';

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly tooltip: string;
  readonly accent: Accent;
}

/** Tarjetas del "Resumen general": totales de la ventana seleccionada. */
@Component({
  selector: 'app-metric-stat-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div class="cards">
      @for (card of cards(); track card.label) {
        <div class="card">
          <div class="card__label">
            <span class="card__label-text">{{ card.label }}</span>
            <mat-icon
              class="card__info"
              [matTooltip]="card.tooltip"
              matTooltipClass="stat-tip"
              matTooltipPosition="above"
              >info</mat-icon
            >
          </div>
          <div
            class="card__value"
            [class.card__value--green]="card.accent === 'green'"
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
  protected readonly t = DASHBOARDS_TEXTS.statCards;
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
    // La tasa de éxito contempla éxitos, fallos y omitidos; los reencolados son
    // reintentos transitorios (no un resultado terminal), así que se excluyen del
    // denominador para no diluir la tasa.
    const rateBase = totals.success + failures + totals.skipped;
    const successRate = rateBase ? totals.success / rateBase : null;
    const rateText = rateBase
      ? this.t.successRateHint(totals.success, rateBase, pct(successRate))
      : this.t.noJobsInWindow;
    const typeLines = this.summary()
      .map((entry) => prod(entry.product_label ?? entry.job_type))
      .sort((a, b) => a.localeCompare(b))
      .map((label) => `• ${label}`)
      .join('\n');

    return [
      {
        label: this.t.finished,
        value: String(totals.total),
        tooltip: this.t.finishedHint,
        accent: '',
      },
      {
        label: this.t.successes,
        value: String(totals.success),
        tooltip: this.t.successesHint,
        accent: 'green',
      },
      {
        label: this.t.failures,
        value: String(failures),
        tooltip: this.t.failuresHint(totals.error, totals.dlq),
        accent: failures > 0 ? 'orange' : '',
      },
      {
        label: this.t.skipped,
        value: String(totals.skipped),
        tooltip: this.t.skippedHint,
        accent: '',
      },
      {
        label: this.t.successRate,
        value: rateBase ? pct(successRate) : '—',
        tooltip: rateText,
        accent: '',
      },
      {
        label: this.t.dlq,
        value: String(totals.dlq),
        tooltip: this.t.dlqHint,
        accent: totals.dlq > 0 ? 'red' : '',
      },
      {
        label: this.t.requeued,
        value: String(totals.requeued),
        tooltip: this.t.requeuedHint,
        accent: '',
      },
      {
        label: this.t.types,
        value: String(this.summary().length),
        tooltip: typeLines ? this.t.typesHint(typeLines) : this.t.noTypes,
        accent: '',
      },
    ];
  });
}
