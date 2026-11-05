import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DataSyncDomainStatus } from '../../../models/metrics/data-metrics.models';
import { domainLabel } from '../../../services/metrics/data-metrics-labels';
import { ago, fmtInstant, secs } from '../../../services/metrics/metrics-format.util';
import { SortableTableComponent } from '../../dashboard/sortable-table/sortable-table.component';
import {
  buildTable,
  pillCell,
  textCell,
  type Cell,
  type ColumnSpec,
  type SortState,
} from '../../dashboard/sortable-table/sortable-table.models';
import { DASHBOARDS_TEXTS } from '../../../texts';

function resultCell(outcome: string | null): Cell {
  if (outcome === 'ok') {
    return pillCell('success', DATA.outcomes.ok);
  }
  if (outcome === 'error') {
    return pillCell('error', DATA.outcomes.error);
  }
  return textCell('—', { muted: true });
}

const DATA = DASHBOARDS_TEXTS.data;

const COLUMNS: ReadonlyArray<ColumnSpec<DataSyncDomainStatus>> = [
  {
    header: { key: 'dominio', label: DATA.columns.domain, align: 'left', sortable: true },
    cell: (r) => textCell(domainLabel(r.domain), { strong: true }),
    sortValue: (r) => domainLabel(r.domain),
  },
  {
    header: { key: 'resultado', label: DATA.columns.outcome, align: 'center', sortable: true },
    cell: (r) => resultCell(r.outcome),
    sortValue: (r) => r.outcome ?? '',
  },
  {
    header: { key: 'descargado', label: DATA.columns.downloaded, align: 'center', sortable: true },
    cell: (r) =>
      textCell(r.last_downloaded == null ? '—' : r.last_downloaded.toLocaleString('es-AR')),
    sortValue: (r) => r.last_downloaded ?? -1,
  },
  {
    header: { key: 'errores', label: DATA.columns.errors, align: 'center', sortable: true },
    cell: (r) =>
      textCell(String(r.last_errors ?? 0), {
        tone: (r.last_errors ?? 0) > 0 ? 'err' : undefined,
      }),
    sortValue: (r) => r.last_errors ?? 0,
  },
  {
    header: { key: 'duracion', label: DATA.columns.duration, align: 'center', sortable: true },
    cell: (r) => textCell(secs(r.last_duration_ms == null ? null : r.last_duration_ms / 1000)),
    sortValue: (r) => r.last_duration_ms ?? -1,
  },
  {
    header: { key: 'ultimo', label: DATA.columns.lastCycle, align: 'center', sortable: true },
    cell: (r) =>
      textCell(ago(r.last_finished), { muted: true, title: fmtInstant(r.last_finished) }),
    // Parse to epoch ms so ordering is chronological, not lexicographic on the
    // ISO string (and nulls sort first rather than mixing with real timestamps).
    sortValue: (r) => (r.last_finished ? Date.parse(r.last_finished) : -1),
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
      [emptyText]="t.noCyclesYet"
    />
  `,
})
export class DataSyncStatusTableComponent {
  protected readonly t = DASHBOARDS_TEXTS.data;
  readonly domains = input.required<readonly DataSyncDomainStatus[]>();

  readonly initialSort: SortState = { key: 'ultimo', dir: 'desc' };

  readonly table = computed(() => buildTable(COLUMNS, this.domains()));
}
