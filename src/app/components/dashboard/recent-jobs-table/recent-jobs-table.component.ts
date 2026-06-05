import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';

import type { RecentJob } from '../../../models/metrics/metrics.models';
import { ago, secs } from '../../../services/metrics/metrics-format.util';
import { outcomeLabel, prod } from '../../../services/metrics/metrics-labels.constants';
import { JobDetailDialogComponent } from '../job-detail-dialog/job-detail-dialog.component';
import { stageLegend } from '../metrics-cells.util';
import { SortableTableComponent } from '../sortable-table/sortable-table.component';
import {
  buildTable,
  errorCell,
  pillCell,
  textCell,
  type Cell,
  type ColumnSpec,
  type SortState,
} from '../sortable-table/sortable-table.models';

const INITIAL_SORT: SortState = { key: 'finished', dir: 'desc' };

/** Detalle: leyenda de etapas si fue exitoso, mensaje de error si no. */
function detailCell(job: RecentJob): Cell {
  return job.outcome === 'success'
    ? textCell(stageLegend(job.stage_timings), { muted: true })
    : errorCell(job.error_message ?? '');
}

const COLUMNS: ReadonlyArray<ColumnSpec<RecentJob>> = [
  {
    header: { key: 'finished', label: 'finalizado', align: 'center', sortable: true },
    cell: (row) => textCell(ago(row.finished_at), { muted: true, title: row.finished_at }),
    sortValue: (row) => row.finished_at,
  },
  {
    header: { key: 'job', label: 'trabajo', align: 'left', sortable: true },
    cell: (row) =>
      textCell(prod(row.product_label ?? row.job_type), { title: row.job_type, strong: true }),
    sortValue: (row) => prod(row.product_label ?? row.job_type),
  },
  {
    header: { key: 'scene', label: 'escena', align: 'left', sortable: true },
    cell: (row) => textCell(row.image_timestamp ?? row.image_id, { muted: true }),
    sortValue: (row) => row.image_timestamp ?? row.image_id,
  },
  {
    header: { key: 'outcome', label: 'resultado', align: 'center', sortable: true },
    cell: (row) =>
      pillCell(
        row.outcome,
        outcomeLabel(row.outcome),
        row.retry_count ? ` r${row.retry_count}` : undefined,
      ),
    sortValue: (row) => row.outcome,
  },
  {
    header: { key: 'total', label: 'total', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.total_s)),
    sortValue: (row) => row.total_s,
  },
  {
    header: { key: 'net', label: 'red', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.download_s)),
    sortValue: (row) => row.download_s,
  },
  {
    header: { key: 'worker', label: 'nodo', align: 'left', sortable: true },
    cell: (row) => textCell(row.worker_host ?? '', { muted: true }),
    sortValue: (row) => row.worker_host ?? '',
  },
  {
    header: { key: 'detail', label: 'detalle', align: 'left', sortable: false },
    cell: detailCell,
    sortValue: (row) => row.total_s ?? 0,
  },
];

/**
 * Tabla "Trabajos recientes": paginada con scroll interno y un botón de
 * "cargar más". El orden se aplica sobre las filas ya cargadas.
 */
@Component({
  selector: 'app-recent-jobs-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SortableTableComponent, MatButtonModule],
  templateUrl: './recent-jobs-table.component.html',
  styleUrl: './recent-jobs-table.component.scss',
})
export class RecentJobsTableComponent {
  readonly jobs = input.required<readonly RecentJob[]>();
  readonly hasMore = input<boolean>(false);
  readonly loadMore = output<void>();

  private readonly dialog = inject(MatDialog);

  readonly initialSort = INITIAL_SORT;

  // `keyOf` = id estable → la fila ordenada se puede mapear de vuelta al trabajo.
  readonly table = computed(() => buildTable(COLUMNS, this.jobs(), (job) => job.id));

  private readonly byId = computed(() => new Map(this.jobs().map((job) => [job.id, job])));

  onRowClick(key: string | number): void {
    const job = this.byId().get(Number(key));
    if (job) {
      this.dialog.open(JobDetailDialogComponent, { data: job, width: '560px', autoFocus: false });
    }
  }
}
