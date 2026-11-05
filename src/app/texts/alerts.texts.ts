/** Texts for polygons, alert generation and the alerts panel/dashboard. */
export const ALERTS_TEXTS = {
  polygons: {
    deleteOneTitle: 'Eliminar polígono',
    deleteAllTitle: 'Eliminar todos los polígonos',
    deleteAllConfirm: 'Eliminar todos',
    /** Confirmation text for deleting one polygon; unnamed polygons are referred to as "este". */
    deleteOne: (name: string | null | undefined): string => {
      const trimmed = name?.trim();
      const subject = trimmed ? `el polígono "${trimmed}"` : 'este polígono';
      return `¿Eliminar ${subject}? No se puede deshacer.`;
    },
    /** Confirmation text for deleting every polygon. */
    deleteAll: (count: number): string => {
      const subject = count === 1 ? 'el polígono' : `los ${count} polígonos`;
      return `¿Eliminar ${subject}? No se puede deshacer.`;
    },
  },
} as const;
