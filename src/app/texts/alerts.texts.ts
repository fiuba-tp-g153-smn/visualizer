/** Texts for polygons, alert generation and the alerts panel/dashboard. */
export const ALERTS_TEXTS = {
  /** Detail rows and titles shared by draft, pending and active alerts. */
  details: {
    alertTitle: (alertId: number): string => `Aviso #${alertId}`,
    draftTitle: (draftNumber: number): string => `Borrador #${draftNumber}`,
    phenomenon: 'Fenómeno:',
    issued: 'Emisión:',
    ends: 'Cese:',
    remaining: 'Tiempo restante:',
    vertices: 'Vértices:',
    area: 'Área:',
    areaValue: (km2: string): string => `${km2} km²`,
    modified: 'Modificado:',
    images: 'Imágenes:',
    departments: 'Departamentos:',
    noDepartments: 'Sin departamentos',
    noProvince: 'Sin provincia',
    showList: 'Ver lista',
    hideList: 'Ocultar lista',
    centerOnPolygon: 'Centrar mapa en el polígono',
    viewAreaImage: 'Ver imagen del área',
    viewGeneralImage: 'Ver imagen general',
    areaGifTitle: (alertId: number): string => `Aviso #${alertId} — Área`,
    generalGifTitle: (alertId: number): string => `Aviso #${alertId} — General`,
  },
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
  panel: {
    generateTab: 'Generar',
    emittedTab: 'Emitidos',
    drawUnavailable: 'No disponible mientras se edita un polígono',
    drawHint:
      'Dibujar nuevo polígono. Click en el mapa para crear puntos. Cierra el polígono clickeando el primer punto o doble-click en el último.',
    draw: 'Dibujar',
    deleteAllTooltip: 'Eliminar todos los polígonos',
    deleteAll: 'Borrar todos',
    detailLevel: 'Nivel de detalle',
    detailLevelHint:
      'Controla el nivel de detalle para las herramientas de recorte y carga de departamentos. Un valor de 1 es más rápido con menor precisión, mientras que 5 proporciona máximo detalle.',
    emptyTitle: 'Sin polígonos',
    emptyHintDraw: 'Usa el botón "Dibujar" arriba para crear polígonos.',
    emptyHintClick: 'Click en el mapa para crear puntos, doble-click para finalizar.',
    editGeometryTooltip: 'Editar geometría del polígono',
    detectDepartments: 'Detectar departamentos afectados',
    searchDepartments: 'Buscar',
    tooManyVerticesDetail: (max: number): string =>
      `Supera el máximo de ${max} vértices. Simplificá el polígono para poder generar el aviso.`,
  },
  emitted: {
    pending: 'Pendientes',
    active: 'Activos',
    refreshingPending: 'Actualizando avisos pendientes...',
    refreshingActive: 'Actualizando avisos activos...',
    refreshHint: 'Actualizar (se actualiza automáticamente cada 10 segundos)',
    collapseSection: 'Contraer sección',
    expandSection: 'Expandir sección',
    noPending: 'Sin avisos pendientes.',
    noActive: 'Sin avisos activos en este momento.',
  },
  emittedAlertMenu: {
    pending: 'Pendiente',
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
