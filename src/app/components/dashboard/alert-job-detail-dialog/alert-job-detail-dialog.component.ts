import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import type { AlertJobMetric } from '../../../models/metrics/alerts-metrics.models';
import { StagePieChartComponent } from '../stage-pie-chart/stage-pie-chart.component';

/** Data passed in by the dashboard: the job row + its resolved phenomenon text. */
export interface AlertJobDialogData {
  readonly job: AlertJobMetric;
  readonly phenomenon: string;
  readonly errorLabel: string | null;
}

interface DetailRow {
  readonly label: string;
  readonly value: string;
}

function ms(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

/**
 * Detalle de un trabajo de generación de aviso: campos + desglose por etapa en
 * una torta (qué etapa tardó más). Presentacional: recibe los datos por
 * `MAT_DIALOG_DATA` y reutiliza la torta compartida `app-stage-pie-chart`.
 */
@Component({
  selector: 'app-alert-job-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule, StagePieChartComponent],
  template: `
    <h1 mat-dialog-title class="ajd__title">
      <span class="ajd__name">{{ data.phenomenon }}</span>
      <span class="ajd__pill" [class]="'ajd__pill--' + data.job.outcome">
        {{ data.job.outcome === 'done' ? 'OK' : 'Falló' }}
      </span>
    </h1>

    <mat-dialog-content>
      <dl class="ajd__grid">
        @for (row of rows(); track row.label) {
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        }
      </dl>

      @if (data.job.outcome === 'failed' && data.errorLabel) {
        <div class="ajd__error">
          <mat-icon>error</mat-icon>
          <span>{{ data.errorLabel }}</span>
        </div>
      }

      @if (hasStages()) {
        <h2 class="ajd__subtitle">Desglose por etapa</h2>
        <app-stage-pie-chart [stages]="stageSeconds()" />
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .ajd__title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
    }
    .ajd__pill {
      font-size: 11px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 10px;
    }
    .ajd__pill--done {
      background: var(--metric-success-bg, #e6f4ec);
      color: var(--metric-success, #2e9b51);
    }
    .ajd__pill--failed {
      background: var(--metric-error-bg, #fdeee5);
      color: var(--metric-error, #e8702a);
    }
    .ajd__grid {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 16px;
      margin: 0 0 8px;
      font-size: 13px;
    }
    .ajd__grid dt {
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .ajd__grid dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .ajd__error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--metric-error-bg, #fdeee5);
      color: var(--metric-error, #e8702a);
      font-size: 13px;
    }
    .ajd__subtitle {
      font-size: 13px;
      font-weight: 600;
      margin: 12px 0 4px;
    }
  `,
})
export class AlertJobDetailDialogComponent {
  readonly data = inject<AlertJobDialogData>(MAT_DIALOG_DATA);

  readonly rows = computed<DetailRow[]>(() => {
    const j = this.data.job;
    return [
      { label: 'Fenómeno', value: `${j.phenomenon_code} — ${this.data.phenomenon}` },
      { label: 'Departamentos', value: j.affected_departments?.toString() ?? '—' },
      { label: 'Vértices', value: j.polygon_vertices?.toString() ?? '—' },
      { label: 'Duración total', value: ms(j.duration_ms) },
      { label: 'Intersección', value: ms(j.intersection_ms) },
      { label: 'Filtrado deptos.', value: ms(j.filter_ms) },
      { label: 'Render (GIF)', value: ms(j.render_ms) },
      { label: 'Guardado', value: ms(j.persist_ms) },
    ];
  });

  /** Per-stage durations in seconds (only stages that ran), keyed for the pie. */
  readonly stageSeconds = computed<Record<string, number>>(() => {
    const j = this.data.job;
    const entries: Array<[string, number | null]> = [
      ['intersect', j.intersection_ms],
      ['filter', j.filter_ms],
      ['render', j.render_ms],
      ['persist', j.persist_ms],
    ];
    const out: Record<string, number> = {};
    for (const [key, value] of entries) {
      if (value != null && value > 0) {
        out[key] = value / 1000;
      }
    }
    return out;
  });

  readonly hasStages = computed<boolean>(() => Object.keys(this.stageSeconds()).length > 0);
}
