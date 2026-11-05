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
  polygonMenu: {
    editGeometry: 'Editar geometría',
    cutting: 'Recortando...',
    cutWithArgentina: 'Recortar con Argentina',
    undoCut: 'Deshacer recorte',
    loadingDepartments: 'Cargando departamentos...',
    showDepartments: 'Mostrar departamentos',
    hideDepartments: 'Ocultar departamentos',
    tooManyVertices: (max: number): string => `Supera el máximo de ${max} vértices permitidos`,
    generatingAlert: 'Generando aviso...',
    generateAlert: 'Generar aviso',
  },
  emittedAlertMenu: {
    title: (alertId: number): string => `Aviso #${alertId}`,
    pending: 'Pendiente',
    phenomenon: 'Fenómeno:',
    issued: 'Emisión:',
    ends: 'Cese:',
    viewAreaImage: 'Ver imagen del área',
    viewGeneralImage: 'Ver imagen general',
  },
  gifPreview: {
    loadError: 'No se pudo cargar la imagen.',
  },
  phenomenonDialog: {
    title: 'Generar aviso',
    loading: 'Cargando fenómenos meteorológicos...',
    prompt: 'Seleccione el código de fenómeno meteorológico:',
    codeLabel: 'Código de fenómeno',
    usingLocalData: 'Usando datos locales (backend no disponible)',
    confirm: 'Generar aviso',
  },
} as const;
