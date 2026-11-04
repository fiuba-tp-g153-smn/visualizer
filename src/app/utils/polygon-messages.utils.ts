/** Confirmation text for deleting one polygon; unnamed polygons are referred to as "este". */
export function deletePolygonMessage(name: string | null | undefined): string {
  const trimmed = name?.trim();
  const subject = trimmed ? `el polígono "${trimmed}"` : 'este polígono';
  return `¿Eliminar ${subject}? No se puede deshacer.`;
}

/** Confirmation text for deleting every polygon. */
export function deleteAllPolygonsMessage(count: number): string {
  const subject = count === 1 ? 'el polígono' : `los ${count} polígonos`;
  return `¿Eliminar ${subject}? No se puede deshacer.`;
}
