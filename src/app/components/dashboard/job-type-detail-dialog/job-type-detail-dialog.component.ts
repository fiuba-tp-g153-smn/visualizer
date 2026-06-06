import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import type { JobTypeSummary } from '../../../models/metrics/metrics.models';
import { ago, pct, secs } from '../../../services/metrics/metrics-format.util';
import { prod } from '../../../services/metrics/metrics-labels.constants';
import { outcomePillsCell, stageBarCell } from '../metrics-cells.util';
import type { BarSegment } from '../sortable-table/sortable-table.models';
import { StagePieChartComponent } from '../stage-pie-chart/stage-pie-chart.component';

/** Fila etiqueta/valor del detalle. */
interface DetailRow {
  readonly label: string;
  readonly value: string;
  readonly title?: string;
}

/** Píldora de conteo por resultado. */
interface OutcomePill {
  readonly outcome: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Diálogo de detalle de un tipo de trabajo: muestra todas las estadísticas de la
 * fila (conteos por resultado, % de error, tiempos prom/mín/máx/p95, descarga y
 * último), el desglose por etapa como barra apilada y la torta del desglose.
 * Presentacional: recibe el `JobTypeSummary` por `MAT_DIALOG_DATA` y reutiliza
 * los formateadores, etiquetas y fábricas de celdas existentes.
 */
@Component({
  selector: 'app-job-type-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, StagePieChartComponent],
  templateUrl: './job-type-detail-dialog.component.html',
  styleUrl: './job-type-detail-dialog.component.scss',
})
export class JobTypeDetailDialogComponent {
  readonly summary = inject<JobTypeSummary>(MAT_DIALOG_DATA);

  readonly title = computed<string>(() =>
    prod(this.summary.product_label ?? this.summary.job_type),
  );

  /** Conteos + tiempos del tipo, en orden de lectura. */
  readonly rows = computed<DetailRow[]>(() => {
    const summary = this.summary;
    return [
      { label: 'Trabajos', value: String(summary.counts.total) },
      { label: '% error', value: pct(summary.error_rate) },
      { label: 'Prom', value: secs(summary.total_s.avg) },
      { label: 'Mín', value: secs(summary.total_s.min) },
      { label: 'Máx', value: secs(summary.total_s.max) },
      { label: 'p95', value: secs(summary.total_s.p95) },
      { label: 'Descarga', value: secs(summary.download_s.avg) },
      { label: 'Último', value: ago(summary.last_finished), title: summary.last_finished },
    ];
  });

  /** Píldoras de resultado (solo las que tienen al menos un trabajo). */
  readonly outcomes = computed<readonly OutcomePill[]>(
    () => outcomePillsCell(this.summary.counts).items ?? [],
  );

  /** Segmentos de la barra apilada del desglose por etapa. */
  readonly segments = computed<readonly BarSegment[]>(
    () => stageBarCell(this.summary.stages).segments ?? [],
  );

  /** Leyenda textual del desglose por etapa. */
  readonly legend = computed<string>(() => stageBarCell(this.summary.stages).legend ?? '');
}
