import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import type { RecentJob } from '../../../models/metrics/metrics.models';
import { secs } from '../../../services/metrics/metrics-format.util';
import { outcomeLabel, prod, stageLabel } from '../../../services/metrics/metrics-labels.constants';

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
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './job-detail-dialog.component.html',
  styleUrl: './job-detail-dialog.component.scss',
})
export class JobDetailDialogComponent {
  readonly job = inject<RecentJob>(MAT_DIALOG_DATA);

  readonly title = computed<string>(() => prod(this.job.product_label ?? this.job.job_type));
  readonly outcomeText = computed<string>(() => outcomeLabel(this.job.outcome));

  /** Identificación + tiempos, en orden de lectura. */
  readonly rows = computed<DetailRow[]>(() => {
    const job = this.job;
    return [
      { label: 'Imagen', value: job.image_id, title: job.image_id },
      { label: 'Escena', value: job.image_timestamp ?? '—' },
      { label: 'Work unit', value: job.work_unit_id ?? '—' },
      { label: 'Fuente de datos', value: job.data_source_id },
      { label: 'Procesador', value: job.processor_id ?? '—' },
      { label: 'Banda', value: job.band_id ?? '—' },
      { label: 'Tipo', value: job.job_type },
      { label: 'Nodo', value: job.worker_host ?? '—' },
      { label: 'Inicio', value: job.started_at },
      { label: 'Fin', value: job.finished_at },
      { label: 'Total', value: secs(job.total_s) },
      { label: 'Red (descarga)', value: secs(job.download_s) },
      { label: 'Proceso', value: secs(job.process_s) },
      { label: 'Reintentos', value: String(job.retry_count) },
    ];
  });

  /** Desglose por etapa (vacío si el trabajo no registró tiempos por etapa). */
  readonly stages = computed<DetailRow[]>(() =>
    Object.entries(this.job.stage_timings ?? {}).map(([name, value]) => ({
      label: stageLabel(name),
      value: secs(value),
    })),
  );
}
