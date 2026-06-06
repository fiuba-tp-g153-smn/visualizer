import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { JobTypeSummary } from '../../../models/metrics/metrics.models';
import { ago, pct, secs } from '../../../services/metrics/metrics-format.util';
import { prod } from '../../../services/metrics/metrics-labels.constants';
import { outcomePillsCell, stageBarCell, stageTotal } from '../metrics-cells.util';
import { SortableTableComponent } from '../sortable-table/sortable-table.component';
import {
  buildTable,
  textCell,
  type ColumnSpec,
  type SortState,
} from '../sortable-table/sortable-table.models';

const INITIAL_SORT: SortState = { key: 'n', dir: 'desc' };

const COLUMNS: ReadonlyArray<ColumnSpec<JobTypeSummary>> = [
  {
    header: { key: 'type', label: 'tipo de trabajo', align: 'left', sortable: true },
    cell: (row) =>
      textCell(prod(row.product_label ?? row.job_type), { title: row.job_type, strong: true }),
    sortValue: (row) => prod(row.product_label ?? row.job_type),
  },
  {
    header: { key: 'n', label: 'n', align: 'center', sortable: true },
    cell: (row) => textCell(String(row.counts.total)),
    sortValue: (row) => row.counts.total,
  },
  {
    header: { key: 'outcomes', label: 'resultados', align: 'center', sortable: true },
    cell: (row) => outcomePillsCell(row.counts),
    sortValue: (row) => row.counts.error + row.counts.dlq,
  },
  {
    header: { key: 'err', label: '% error', align: 'center', sortable: true },
    cell: (row) => textCell(pct(row.error_rate)),
    sortValue: (row) => row.error_rate,
  },
  {
    header: { key: 'avg', label: 'prom', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.total_s.avg)),
    sortValue: (row) => row.total_s.avg,
  },
  {
    header: { key: 'min', label: 'mín', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.total_s.min)),
    sortValue: (row) => row.total_s.min,
  },
  {
    header: { key: 'max', label: 'máx', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.total_s.max)),
    sortValue: (row) => row.total_s.max,
  },
  {
    header: { key: 'p95', label: 'p95', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.total_s.p95)),
    sortValue: (row) => row.total_s.p95,
  },
  {
    header: { key: 'net', label: 'descarga', align: 'center', sortable: true },
    cell: (row) => textCell(secs(row.download_s.avg)),
    sortValue: (row) => row.download_s.avg,
  },
  {
    header: { key: 'stages', label: 'desglose por etapa', align: 'center', sortable: true },
    cell: (row) => stageBarCell(row.stages),
    sortValue: (row) => stageTotal(row.stages),
  },
  {
    header: { key: 'last', label: 'último', align: 'center', sortable: true },
    cell: (row) => textCell(ago(row.last_finished), { muted: true, title: row.last_finished }),
    sortValue: (row) => row.last_finished,
  },
];

/** Tabla "Por tipo de trabajo": estadísticas agregadas, ordenable por columna. */
@Component({
  selector: 'app-job-type-summary-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SortableTableComponent],
  template: `
    <app-sortable-table
      [headers]="table().headers"
      [rows]="table().tableRows"
      [initialSort]="initialSort"
      emptyText="Aún no hay trabajos registrados."
      (rowClick)="onRowClick($event)"
    />
  `,
})
export class JobTypeSummaryTableComponent {
  readonly summary = input.required<readonly JobTypeSummary[]>();

  /** Emite el `job_type` de la fila clickeada (drill-down hacia los trabajos). */
  readonly typeClick = output<string>();

  readonly initialSort = INITIAL_SORT;

  // `keyOf` = job_type → la fila es clickeable y reemite ese tipo.
  readonly table = computed(() => buildTable(COLUMNS, this.summary(), (row) => row.job_type));

  onRowClick(key: string | number): void {
    this.typeClick.emit(String(key));
  }
}
