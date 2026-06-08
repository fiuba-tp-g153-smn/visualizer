import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import type { DataSyncCycle } from '../../../models/metrics/data-metrics.models';
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

function resultCell(outcome: string): Cell {
  if (outcome === 'ok') {
    return pillCell('success', 'ok');
  }
  if (outcome === 'error') {
    return pillCell('error', 'error');
  }
  return textCell(outcome, { muted: true });
}

const COLUMNS: ReadonlyArray<ColumnSpec<DataSyncCycle>> = [
  {
    header: { key: 'finalizado', label: 'finalizado', align: 'center', sortable: true },
    cell: (c) => textCell(ago(c.finished_at), { muted: true, title: fmtInstant(c.finished_at) }),
    sortValue: (c) => c.finished_at,
  },
  {
    header: { key: 'dominio', label: 'dominio', align: 'left', sortable: true },
    cell: (c) => textCell(domainLabel(c.domain)),
    sortValue: (c) => domainLabel(c.domain),
  },
  {
    header: { key: 'descargado', label: 'descargado', align: 'center', sortable: true },
    cell: (c) => textCell(c.downloaded.toLocaleString('es-AR')),
    sortValue: (c) => c.downloaded,
  },
  {
    header: { key: 'errores', label: 'errores', align: 'center', sortable: true },
    cell: (c) => textCell(String(c.errors), { tone: c.errors > 0 ? 'err' : undefined }),
    sortValue: (c) => c.errors,
  },
  {
    header: { key: 'duracion', label: 'duración', align: 'center', sortable: true },
    cell: (c) => textCell(`${(c.duration_ms / 1000).toFixed(1)}s`),
    sortValue: (c) => c.duration_ms,
  },
  {
    header: { key: 'resultado', label: 'resultado', align: 'center', sortable: true },
    cell: (c) => resultCell(c.outcome),
    sortValue: (c) => c.outcome,
  },
];

/** Ciclos de sync recientes: ordenables, con tope de scroll + "cargar más". */
@Component({
  selector: 'app-data-sync-cycles-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SortableTableComponent, MatButtonModule],
  template: `
    <div class="cycles__scroll">
      <app-sortable-table
        [headers]="table().headers"
        [rows]="table().tableRows"
        [initialSort]="initialSort"
        emptyText="Sin ciclos en la ventana seleccionada."
      />
    </div>
    <div class="cycles__foot">
      <button mat-stroked-button [disabled]="!hasMore()" (click)="loadMore.emit()">
        cargar 50 más
      </button>
      <span class="cycles__count">{{ cycles().length }} cargados</span>
      <span class="cycles__hint">(el orden aplica a las filas cargadas)</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .cycles__scroll {
      max-height: 460px;
      overflow-y: auto;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .cycles__foot {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-top: 1px solid var(--mat-sys-outline-variant, #ececec);
      font-size: 11px;
    }
    .cycles__count {
      color: var(--mat-sys-on-surface-variant, #5f6368);
    }
    .cycles__hint {
      color: var(--mat-sys-on-surface-variant, #9aa0a6);
    }
  `,
})
export class DataSyncCyclesTableComponent {
  readonly cycles = input.required<readonly DataSyncCycle[]>();
  readonly hasMore = input<boolean>(false);
  readonly loadMore = output<void>();

  readonly initialSort: SortState = { key: 'finalizado', dir: 'desc' };

  readonly table = computed(() => buildTable(COLUMNS, this.cycles()));
}
