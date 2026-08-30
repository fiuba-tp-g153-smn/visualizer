import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { MapPointValueEntry, MapPointValuesComponent } from './point-values';
import { PointQueryStatus } from '../../../models';

function entry(layerId: string, overrides: Partial<MapPointValueEntry> = {}): MapPointValueEntry {
  return {
    layerId,
    layerName: layerId,
    isPlaying: false,
    isLoading: false,
    data: { layerId, layerName: layerId, status: PointQueryStatus.NO_DATA },
    ...overrides,
  };
}

function createComponent(entries: MapPointValueEntry[]): MapPointValuesComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(MapPointValuesComponent);
  fixture.componentRef.setInput('entries', entries);
  fixture.detectChanges();
  return fixture.componentInstance;
}

function layerIdsOf(columns: ReadonlyArray<ReadonlyArray<{ layerId: string }>>): string[][] {
  return columns.map((column) => column.map((e) => e.layerId));
}

describe('MapPointValuesComponent columns', () => {
  it('distributes entries round-robin, rendering right-to-left', () => {
    const component = createComponent([entry('a'), entry('b'), entry('c'), entry('d'), entry('e')]);

    expect(component.columnCount).toBe(2);
    expect(layerIdsOf(component.columns())).toEqual([
      ['b', 'd'],
      ['a', 'c', 'e'],
    ]);
  });

  it('gives every chip in a row the same minDetailLines, matching the tallest one', () => {
    const component = createComponent([
      entry('a', { runLabel: 'Corrida', periodLabel: '18:00' }),
      entry('b'),
      entry('c'),
      entry('d', { runLabel: 'Corrida', periodLabel: '18:00' }),
    ]);

    const byId = new Map(
      component
        .columns()
        .flat()
        .map((e) => [e.layerId, e.minDetailLines]),
    );
    expect(byId.get('a')).toBe(2);
    expect(byId.get('b')).toBe(2);
    expect(byId.get('c')).toBe(2);
    expect(byId.get('d')).toBe(2);
  });

  it('does not force lines on rows where no chip needs them', () => {
    const component = createComponent([entry('a'), entry('b')]);

    const byId = new Map(
      component
        .columns()
        .flat()
        .map((e) => [e.layerId, e.minDetailLines]),
    );
    expect(byId.get('a')).toBe(0);
    expect(byId.get('b')).toBe(0);
  });
});
