import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { SortableTableComponent } from './sortable-table.component';
import { textCell, type HeaderDef, type TableRow } from './sortable-table.models';

const HEADERS: HeaderDef[] = [
  { key: 'name', label: 'name', align: 'left', sortable: true },
  { key: 'n', label: 'n', align: 'center', sortable: true },
];

function row(name: string, n: number): TableRow {
  return { cells: [textCell(name), textCell(String(n))], sortValues: [name, n] };
}

const ROWS: TableRow[] = [row('beta', 2), row('alpha', 5), row('gamma', 1)];

function createTable() {
  const fixture = TestBed.createComponent(SortableTableComponent);
  fixture.componentRef.setInput('headers', HEADERS);
  fixture.componentRef.setInput('rows', ROWS);
  return fixture;
}

describe('SortableTableComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('applies the initial sort descending by the numeric column', () => {
    const fixture = createTable();
    fixture.componentRef.setInput('initialSort', { key: 'n', dir: 'desc' });
    const order = fixture.componentInstance.sortedRows().map((r) => r.sortValues[1]);
    expect(order).toEqual([5, 2, 1]);
  });

  it('toggles to ascending when the active header is clicked again', () => {
    const fixture = createTable();
    fixture.componentRef.setInput('initialSort', { key: 'n', dir: 'desc' });
    const cmp = fixture.componentInstance;

    cmp.onHeaderClick(HEADERS[1]); // n is already active desc -> asc
    expect(cmp.sortedRows().map((r) => r.sortValues[1])).toEqual([1, 2, 5]);
  });

  it('sorts strings with localeCompare when a text header is selected', () => {
    const fixture = createTable();
    const cmp = fixture.componentInstance;

    cmp.onHeaderClick(HEADERS[0]); // name -> desc by default
    expect(cmp.sortedRows().map((r) => r.sortValues[0])).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('ignores clicks on non-sortable headers', () => {
    const fixture = createTable();
    fixture.componentRef.setInput('rows', ROWS);
    const cmp = fixture.componentInstance;
    const fixedHeader: HeaderDef = { key: 'x', label: 'x', align: 'left', sortable: false };

    cmp.onHeaderClick(fixedHeader);
    expect(cmp.activeKey()).toBeNull();
  });
});
