import { describe, it, expect } from 'vitest';
import { deleteAllPolygonsMessage, deletePolygonMessage } from './polygon-messages.utils';

describe('deletePolygonMessage', () => {
  it('names the polygon when it has a name', () => {
    expect(deletePolygonMessage('Tormenta norte')).toBe(
      '¿Eliminar el polígono "Tormenta norte"? No se puede deshacer.',
    );
  });

  it('refers to an unnamed polygon as "este polígono"', () => {
    expect(deletePolygonMessage(undefined)).toBe('¿Eliminar este polígono? No se puede deshacer.');
    expect(deletePolygonMessage('  ')).toBe('¿Eliminar este polígono? No se puede deshacer.');
  });
});

describe('deleteAllPolygonsMessage', () => {
  it('counts the polygons', () => {
    expect(deleteAllPolygonsMessage(3)).toBe('¿Eliminar los 3 polígonos? No se puede deshacer.');
  });

  it('uses the singular for one polygon', () => {
    expect(deleteAllPolygonsMessage(1)).toBe('¿Eliminar el polígono? No se puede deshacer.');
  });
});
