/**
 * Modelo de la tabla ordenable genérica. La tabla es agnóstica al dominio:
 * recibe encabezados y filas ya "renderizadas" (celdas + valores de orden),
 * por lo que no necesita genéricos ni narrowing en la plantilla.
 */

export type SortDir = 'asc' | 'desc';
export type CellAlign = 'left' | 'center' | 'right';

/** Definición de un encabezado de columna. */
export interface HeaderDef {
  /** Clave estable para el estado de orden. */
  readonly key: string;
  readonly label: string;
  readonly align: CellAlign;
  readonly sortable: boolean;
}

/** Segmento de la barra de desglose por etapa. */
export interface BarSegment {
  readonly color: string;
  readonly widthPct: number;
  readonly title: string;
}

/**
 * Celda renderizable. Es una interfaz única (no una unión discriminada) para
 * que la plantilla acceda a los campos sin depender del narrowing de Angular;
 * las fábricas de abajo garantizan que cada `kind` se construya bien.
 */
export interface Cell {
  readonly kind: 'text' | 'pill' | 'pills' | 'bar' | 'error';
  readonly text?: string;
  readonly title?: string;
  readonly muted?: boolean;
  readonly strong?: boolean;
  readonly outcome?: string;
  readonly label?: string;
  readonly suffix?: string;
  readonly items?: ReadonlyArray<{ label: string; outcome: string; count: number }>;
  readonly segments?: readonly BarSegment[];
  readonly legend?: string;
  readonly message?: string;
}

/** Una fila ya proyectada a celdas + valores de orden (paralelos a las columnas). */
export interface TableRow {
  readonly cells: readonly Cell[];
  readonly sortValues: ReadonlyArray<number | string | null>;
  /** Identidad opcional del dominio: habilita el click de fila (ver `buildTable`). */
  readonly key?: string | number;
}

export interface SortState {
  readonly key: string;
  readonly dir: SortDir;
}

/** Especificación de columna del lado del dominio (encabezado + celda + orden). */
export interface ColumnSpec<T> {
  readonly header: HeaderDef;
  readonly cell: (row: T) => Cell;
  readonly sortValue: (row: T) => number | string | null;
}

// ── Fábricas de celdas ───────────────────────────────────────────────────────

export function textCell(
  value: string,
  opts: { title?: string; muted?: boolean; strong?: boolean } = {},
): Cell {
  return { kind: 'text', text: value, ...opts };
}

export function pillCell(outcome: string, label: string, suffix?: string): Cell {
  return { kind: 'pill', outcome, label, suffix };
}

export function pillsCell(
  items: ReadonlyArray<{ label: string; outcome: string; count: number }>,
): Cell {
  return { kind: 'pills', items };
}

export function barCell(segments: readonly BarSegment[], legend: string): Cell {
  return { kind: 'bar', segments, legend };
}

export function errorCell(message: string): Cell {
  return { kind: 'error', message };
}

/**
 * Aplana especificaciones de columna + filas del dominio a la forma de la tabla.
 * Si se pasa `keyOf`, cada fila lleva una `key` estable del dominio que la tabla
 * emite al hacer click (permite mapear la fila ordenada de vuelta a su objeto).
 */
export function buildTable<T>(
  specs: ReadonlyArray<ColumnSpec<T>>,
  rows: readonly T[],
  keyOf?: (row: T, index: number) => string | number,
): { headers: HeaderDef[]; tableRows: TableRow[] } {
  return {
    headers: specs.map((spec) => spec.header),
    tableRows: rows.map((row, index) => ({
      cells: specs.map((spec) => spec.cell(row)),
      sortValues: specs.map((spec) => spec.sortValue(row)),
      ...(keyOf ? { key: keyOf(row, index) } : {}),
    })),
  };
}
