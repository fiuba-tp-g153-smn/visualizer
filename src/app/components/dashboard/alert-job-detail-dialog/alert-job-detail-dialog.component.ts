import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { buildAlertImageUrl } from '../../../config/alerts-metrics.config';
import type { AlertJobMetric } from '../../../models/metrics/alerts-metrics.models';
import { GifPreviewDialogComponent } from '../../floating/gif-preview-dialog/gif-preview-dialog';
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

interface AlertImage {
  readonly label: string;
  readonly title: string;
  readonly filename: string;
  readonly icon: string;
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

      @if (data.job.outcome === 'failed') {
        <div class="ajd__error">
          <mat-icon>error</mat-icon>
          <div class="ajd__error-body">
            <div class="ajd__error-label">{{ data.errorLabel }}</div>
            @if (data.job.error_message) {
              <div class="ajd__error-msg">{{ data.job.error_message }}</div>
            }
          </div>
        </div>
      }

      @if (hasStages()) {
        <h2 class="ajd__subtitle">Desglose por etapa</h2>
        <app-stage-pie-chart [stages]="stageSeconds()" />
      }

      @if (images().length) {
        <h2 class="ajd__subtitle">Imágenes</h2>
        <div class="ajd__images">
          @for (img of images(); track img.filename) {
            <button mat-stroked-button type="button" (click)="openImage(img)">
              <mat-icon>{{ img.icon }}</mat-icon> {{ img.label }}
            </button>
          }
        </div>
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
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--metric-error-bg, #fdeee5);
      color: var(--metric-error, #e8702a);
      font-size: 13px;
    }
    .ajd__error-label {
      font-weight: 600;
    }
    .ajd__error-msg {
      margin-top: 2px;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--mat-sys-on-surface, #1f1f1f);
    }
    .ajd__subtitle {
      font-size: 13px;
      font-weight: 600;
      margin: 12px 0 4px;
    }
    .ajd__images {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class AlertJobDetailDialogComponent {
  readonly data = inject<AlertJobDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);

  /** The (up to two) generated GIFs that exist for this job. */
  readonly images = computed<AlertImage[]>(() => {
    const j = this.data.job;
    const out: AlertImage[] = [];
    if (j.gif_area_filename) {
      out.push({
        label: 'Imagen del área',
        title: `${this.data.phenomenon} — área`,
        filename: j.gif_area_filename,
        icon: 'zoom_in',
      });
    }
    if (j.gif_gral_filename) {
      out.push({
        label: 'Imagen general',
        title: `${this.data.phenomenon} — general`,
        filename: j.gif_gral_filename,
        icon: 'public',
      });
    }
    return out;
  });

  /** Open one GIF in the shared preview (which shows a message if it 404s). */
  openImage(img: AlertImage): void {
    this.dialog.open(GifPreviewDialogComponent, {
      data: { title: img.title, url: buildAlertImageUrl(img.filename) },
      width: '640px',
      autoFocus: false,
    });
  }

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
