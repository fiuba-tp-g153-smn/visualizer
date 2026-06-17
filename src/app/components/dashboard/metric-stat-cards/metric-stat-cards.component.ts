import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { JobTypeSummary } from '../../../models/metrics/metrics.models';
import { pct } from '../../../services/metrics/metrics-format.util';
import { prod } from '../../../services/metrics/metrics-labels.constants';

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
    // La tasa de éxito sólo contempla resultados concluyentes (éxitos + fallos);
    // reencolados y omitidos no son fallos (se reintentan), así que se excluyen
    // del denominador para no diluir la tasa.
    const decided = totals.success + failures;
    const successRate = decided ? totals.success / decided : null;
    const rateText = decided
      ? `${totals.success} éxitos ÷ ${decided} concluyentes (éxitos + fallos) = ${pct(successRate)}. Excluye reencolados y omitidos (no son fallos).`
      : 'Sin trabajos concluyentes (éxitos o fallos) en la ventana.';
    const typeLines = this.summary()
      .map((entry) => prod(entry.product_label ?? entry.job_type))
      .sort((a, b) => a.localeCompare(b))
      .map((label) => `• ${label}`)
      .join('\n');

    return [
      {
        label: 'Trabajos finalizados',
        value: String(totals.total),
        tooltip:
          'Total de trabajos finalizados en la ventana (éxitos + fallos + reencolados + omitidos). Se cuenta por intento.',
        accent: '',
      },
      {
        label: 'Éxitos',
        value: String(totals.success),
        tooltip:
          'Trabajos que completaron el procesamiento correctamente (tiles generados y subidos).',
        accent: 'green',
      },
      {
        label: 'Fallos',
        value: String(failures),
        tooltip: `Trabajos que fallaron con una excepción: errores (${totals.error}) + descartes DLQ (${totals.dlq}). El DLQ es un subconjunto de Fallos.`,
        accent: failures > 0 ? 'orange' : '',
      },
      {
        label: 'Tasa de éxito',
        value: decided ? pct(successRate) : '—',
        tooltip: rateText,
        accent: '',
      },
      {
        label: 'Descartes (DLQ)',
        value: String(totals.dlq),
        tooltip:
          'Trabajos que agotaron los reintentos y fueron a la cola de descartes (fallos terminales que requieren atención).',
        accent: totals.dlq > 0 ? 'red' : '',
      },
      {
        label: 'Reencolados',
        value: String(totals.requeued),
        tooltip:
          'Trabajos reencolados por un error transitorio de descarga para reintentarse. No son fallos.',
        accent: '',
      },
      {
        label: 'Omitidos',
        value: String(totals.skipped),
        tooltip:
          'Trabajos omitidos porque el dato aún no estaba disponible; se reintentan en el próximo ciclo. No son fallos.',
        accent: '',
      },
      {
        label: 'Tipos',
        value: String(this.summary().length),
        tooltip: typeLines ? `Tipos de trabajo activos:\n${typeLines}` : 'Sin tipos activos.',
        accent: '',
      },
    ];
  });
}
