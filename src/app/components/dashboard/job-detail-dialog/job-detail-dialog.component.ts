import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import type { RecentJob } from '../../../models/metrics/metrics.models';
import { fmtInstant, secs } from '../../../services/metrics/metrics-format.util';
import { outcomeLabel, prod } from '../../../services/metrics/metrics-labels.constants';
import { StagePieChartComponent } from '../stage-pie-chart/stage-pie-chart.component';
import { DASHBOARDS_TEXTS } from '../../../texts';

/** Fila etiqueta/valor del detalle. */
interface DetailRow {
  readonly label: string;
  readonly value: string;
  readonly title?: string;
}

/**
 * Diálogo de detalle de un trabajo: muestra todos los campos del `RecentJob`
 * (identificación, tiempos, reintentos, error completo y desglose por etapa).
 * Es presentacional: recibe el trabajo por `MAT_DIALOG_DATA` y reutiliza los
 * formateadores/etiquetas existentes.
 */
@Component({
  selector: 'app-job-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, StagePieChartComponent],
  templateUrl: './job-detail-dialog.component.html',
  styleUrl: './job-detail-dialog.component.scss',
})
export class JobDetailDialogComponent {
  protected readonly common = DASHBOARDS_TEXTS.common;
  readonly job = inject<RecentJob>(MAT_DIALOG_DATA);

  readonly title = computed<string>(() => prod(this.job.product_label ?? this.job.job_type));
  readonly outcomeText = computed<string>(() => outcomeLabel(this.job.outcome));

  /** Identificación + tiempos, en orden de lectura. */
  readonly rows = computed<DetailRow[]>(() => {
    const job = this.job;
    return [
      { label: DASHBOARDS_TEXTS.jobs.detail.image, value: job.image_id, title: job.image_id },
      { label: DASHBOARDS_TEXTS.jobs.detail.scene, value: job.image_timestamp ?? '—' },
      { label: DASHBOARDS_TEXTS.jobs.detail.workUnit, value: job.work_unit_id ?? '—' },
      { label: DASHBOARDS_TEXTS.jobs.detail.dataSource, value: job.data_source_id },
      { label: DASHBOARDS_TEXTS.jobs.detail.processor, value: job.processor_id ?? '—' },
      { label: DASHBOARDS_TEXTS.jobs.detail.band, value: job.band_id ?? '—' },
      { label: DASHBOARDS_TEXTS.jobs.detail.type, value: job.job_type },
      { label: DASHBOARDS_TEXTS.jobs.detail.node, value: job.worker_host ?? '—' },
      {
        label: DASHBOARDS_TEXTS.jobs.detail.start,
        value: fmtInstant(job.started_at),
        title: job.started_at,
      },
      {
        label: DASHBOARDS_TEXTS.jobs.detail.end,
        value: fmtInstant(job.finished_at),
        title: job.finished_at,
      },
      { label: DASHBOARDS_TEXTS.jobs.detail.total, value: secs(job.total_s) },
      { label: DASHBOARDS_TEXTS.jobs.detail.download, value: secs(job.download_s) },
      { label: DASHBOARDS_TEXTS.jobs.detail.process, value: secs(job.process_s) },
      { label: DASHBOARDS_TEXTS.jobs.detail.retries, value: String(job.retry_count) },
    ];
  });
}
