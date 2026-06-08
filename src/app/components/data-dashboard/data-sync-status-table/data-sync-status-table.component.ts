import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DataSyncDomainStatus } from '../../../models/metrics/data-metrics.models';
import { domainLabel } from '../../../services/metrics/data-metrics-labels';
import { ago, fmtInstant } from '../../../services/metrics/metrics-format.util';
import { SortableTableComponent } from '../../dashboard/sortable-table/sortable-table.component';
import {
  buildTable,
  pillCell,
  textCell,
  type Cell,
  type ColumnSpec,
  type SortState,
} from '../../dashboard/sortable-table/sortable-table.models';

function resultCell(outcome: string | null): Cell {
  if (outcome === 'ok') {
    return pillCell('success', 'ok');
  }
  if (outcome === 'error') {
    return pillCell('error', 'error');
  }
  return textCell('—', { muted: true });
}

const COLUMNS: ReadonlyArray<ColumnSpec<DataSyncDomainStatus>> = [
  {
    header: { key: 'dominio', label: 'dominio', align: 'left', sortable: true },
    cell: (r) => textCell(domainLabel(r.domain), { strong: true }),
    sortValue: (r) => domainLabel(r.domain),
  },
  {
    header: { key: 'resultado', label: 'resultado', align: 'center', sortable: true },
    cell: (r) => resultCell(r.outcome),
    sortValue: (r) => r.outcome ?? '',
  },
  {
    header: { key: 'descargado', label: 'descargado', align: 'center', sortable: true },
    cell: (r) =>
      textCell(r.last_downloaded == null ? '—' : r.last_downloaded.toLocaleString('es-AR')),
    sortValue: (r) => r.last_downloaded ?? -1,
  },
  {
    header: { key: 'errores', label: 'errores', align: 'center', sortable: true },
    cell: (r) =>
      textCell(String(r.last_errors ?? 0), {
        tone: (r.last_errors ?? 0) > 0 ? 'err' : undefined,
      }),
    sortValue: (r) => r.last_errors ?? 0,
  },
  {
    header: { key: 'duracion', label: 'duración', align: 'center', sortable: true },
    cell: (r) =>
      textCell(r.last_duration_ms == null ? '—' : `${(r.last_duration_ms / 1000).toFixed(1)}s`),
    sortValue: (r) => r.last_duration_ms ?? -1,
  },
  {
    header: { key: 'ultimo', label: 'último ciclo', align: 'center', sortable: true },
    cell: (r) => textCell(ago(r.last_finished), { muted: true, title: fmtInstant(r.last_finished) }),
    sortValue: (r) => r.last_finished ?? '',
  },
];

/** Estado por dominio de sincronización (último ciclo), ordenable por columna. */
@Component({
  selector: 'app-data-sync-status-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SortableTableComponent],
  template: `
    <app-sortable-table
      [headers]="table().headers"
      [rows]="table().tableRows"
      [initialSort]="initialSort"
      emptyText="Sin ciclos de sync registrados todavía."
    />
  `,
})
export class DataSyncStatusTableComponent {
  readonly domains = input.required<readonly DataSyncDomainStatus[]>();

  readonly initialSort: SortState = { key: 'ultimo', dir: 'desc' };

  readonly table = computed(() => buildTable(COLUMNS, this.domains()));
}
