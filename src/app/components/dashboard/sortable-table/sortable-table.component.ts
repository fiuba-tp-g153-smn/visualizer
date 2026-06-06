import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { HeaderDef, SortDir, SortState, TableRow } from './sortable-table.models';

/**
 * Tabla genérica con encabezados centrados, todas las columnas ordenables y
 * un carét de orden activo. Recibe filas ya renderizadas (ver `buildTable`),
 * así que no conoce el dominio. Reemplaza al `renderTable` del dashboard viejo.
 */
@Component({
  selector: 'app-sortable-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sortable-table.component.html',
  styleUrl: './sortable-table.component.scss',
})
export class SortableTableComponent {
  readonly headers = input.required<readonly HeaderDef[]>();
  readonly rows = input.required<readonly TableRow[]>();
  readonly initialSort = input<SortState | null>(null);
  readonly emptyText = input<string>('Sin datos');

  /** Emite la `key` de la fila clickeada (solo en filas con identidad). */
  readonly rowClick = output<string | number>();

  private readonly userSortKey = signal<string | null>(null);
  private readonly userSortDir = signal<SortDir | null>(null);

  readonly activeKey = computed<string | null>(
    () => this.userSortKey() ?? this.initialSort()?.key ?? null,
  );
  readonly activeDir = computed<SortDir>(
    () => this.userSortDir() ?? this.initialSort()?.dir ?? 'desc',
  );

  /** Índice de la columna por la que se ordena (-1 si ninguna). */
  private readonly sortIndex = computed<number>(() => {
    const key = this.activeKey();
    return key === null ? -1 : this.headers().findIndex((header) => header.key === key);
  });

  readonly sortedRows = computed<readonly TableRow[]>(() => {
    const index = this.sortIndex();
    const rows = this.rows();
    if (index < 0) {
      return rows;
    }
    const dir = this.activeDir();
    return [...rows].sort((a, b) => this.compare(a.sortValues[index], b.sortValues[index], dir));
  });

  private compare(a: number | string | null, b: number | string | null, dir: SortDir): number {
    let result: number;
    if (typeof a === 'number' && typeof b === 'number') {
      result = a - b;
    } else {
      result = String(a ?? '').localeCompare(String(b ?? ''));
    }
    return dir === 'desc' ? -result : result;
  }

  isActive(header: HeaderDef): boolean {
    return this.activeKey() === header.key;
  }

  caret(header: HeaderDef): string {
    if (!this.isActive(header)) {
      return '';
    }
    return this.activeDir() === 'desc' ? ' ▼' : ' ▲';
  }

  onRowClick(row: TableRow): void {
    if (row.key !== undefined) {
      this.rowClick.emit(row.key);
    }
  }

  onHeaderClick(header: HeaderDef): void {
    if (!header.sortable) {
      return;
    }
    if (this.activeKey() === header.key) {
      this.userSortKey.set(header.key);
      this.userSortDir.set(this.activeDir() === 'desc' ? 'asc' : 'desc');
    } else {
      this.userSortKey.set(header.key);
      this.userSortDir.set('desc');
    }
  }
}
