/** Texts for the layers panel: available/active tabs, layer rows and sync groups. */
export const LAYERS_TEXTS = {
  tabs: {
    available: 'Disponibles',
    active: 'Activas',
    sync: 'Sincronización',
  },
  noLayers: {
    title: 'Sin capas disponibles',
    hint: 'No hay capas configuradas para visualizar.',
  },
  available: {
    searchPlaceholder: 'Buscar capas',
    noResults: 'No se encontraron resultados',
    noResultsHint: 'Intenta con otros términos de búsqueda',
    rechecking: 'Verificando…',
    recheck: 'Volver a verificar disponibilidad',
  },
  active: {
    emptyTitle: 'Sin capas activas',
    emptyHint: 'Encendé capas para ajustarlas y ordenarlas acá.',
    clearGroup: (group: string): string => `Desactivar todas las capas de ${group.toLowerCase()}`,
  },
  item: {
    noDescription: 'Sin descripción',
    showScale: 'Mostrar escala',
    hideScale: 'Ocultar escala',
    collapse: 'Contraer',
    expand: 'Expandir',
    deactivate: 'Desactivar capa',
    opacity: 'Opacidad',
    elevations: 'Elevaciones',
    expandElevations: 'Expandir controles de elevación',
    runs: 'Corridas',
    expandRuns: 'Expandir controles de corrida',
    collapseLayers: 'Contraer capas',
    expandLayers: 'Expandir capas',
    unreachable: 'Servicio no disponible',
    noDataAvailable: 'Sin datos disponibles',
    unreachableBadge: 'No disponible',
    noDataBadge: 'Sin datos',
    period: 'Período',
    syncedTooltip: 'Controlado por sincronización',
    synced: 'Sincronizado',
    loadingPeriods: 'Cargando períodos disponibles...',
    refreshPeriods:
      'Actualizar períodos disponibles (se actualiza automáticamente cada 10 segundos)',
    noElevation: 'Sin elevación seleccionada',
    noForecast: 'Sin pronóstico seleccionado',
    noRenders: 'Sin capas seleccionadas',
    noPeriods: 'No hay períodos disponibles',
    unsync: 'Desconectar de sincronización',
    allImages: 'Todas',
    loadingTime: 'Cargando...',
    noTime: 'Sin datos',
  },
  stations: {
    query: 'Consulta',
    latest: 'Más reciente',
    specific: 'Específico',
    showSpecific: 'Mostrar configuración específica',
    hideSpecific: 'Ocultar configuración específica',
    tolerance: 'Tolerancia',
    showWithoutDataHint:
      'Cuando se desactiva, las estaciones sin observación dentro del período solicitado se ocultan del mapa.',
    showWithoutData: 'Mostrar estaciones sin observación',
    apiKeyRequired:
      'Necesitás configurar tu clave API del SMN para activar las estaciones meteorológicas.',
    serverDown: 'el servidor no está disponible en este momento',
    connectionFailed: 'no se pudo establecer la conexión',
    loadError: (detail: string): string =>
      `No se pudieron cargar las estaciones meteorológicas: ${detail}.`,
  },
  refresh: {
    periodsAvailable: (count: number, layer: string): string =>
      `${count} períodos disponibles para ${layer}`,
    noChanges: (layer: string): string => `Sin cambios para ${layer}`,
    added: (n: number, layer: string): string => {
      const plural = n !== 1 ? 's' : '';
      return `${n} período${plural} agregado${plural} para ${layer}`;
    },
    removed: (n: number, layer: string): string => {
      const plural = n !== 1 ? 's' : '';
      return `${n} período${plural} eliminado${plural} para ${layer}`;
    },
    modified: (n: number, layer: string): string => {
      const plural = n !== 1 ? 's' : '';
      return `${n} período${plural} modificado${plural} para ${layer}`;
    },
    addedAndRemoved: (added: number, removed: number, layer: string): string =>
      `${added} período${added !== 1 ? 's' : ''} agregado${added !== 1 ? 's' : ''}, ${removed} eliminado${removed !== 1 ? 's' : ''} para ${layer}`,
    unavailable: (layer: string): string =>
      `La capa "${layer}" no está disponible temporalmente. Verificá la conexión con el servidor.`,
  },
  /** Prefixes and names used to build a layer's full display name. */
  displayNames: {
    goes: 'GOES 19',
    rma: (n: string): string => `RMA ${n}`,
    intaRadars: {
      PAR: 'INTA Paraná',
      ANG: 'INTA Anguil',
      PER: 'INTA Pergamino',
    },
  },
  /** Display names of forecast secondary renders, keyed by the render id suffix. */
  forecastRenders: {
    barbs: 'Barbas',
    mslp: 'Presión a nivel del mar',
    gustThreshold: 'Umbral de ráfagas',
    shear850500: 'Cortante 850-500 hPa',
    shear850700: 'Cortante 850-700 hPa',
    brn: 'Bulk Richardson Number',
    thickness: 'Espesores 1000/500',
    heights: 'Geopotencial',
    isotherms: 'Isotermas',
    hailDiameterMax: 'Diámetro máximo de granizo',
  },
  /** Playback controls shared by a layer's own timeline and a sync group's. */
  playback: {
    play: 'Reproducir',
    pause: 'Pausar',
    firstImage: 'Ir a la primera imagen',
    lastImage: 'Ir a la última imagen',
    edgeTooltip: (time: string, action: string): string => `${time} · ${action}`,
    imageCount: (count: number): string => `${count} imágenes`,
    images: 'Imágenes',
    imageCountAria: 'Cantidad de imágenes',
    secondsPerImage: 'Segundos por imagen',
  },
  syncGroup: {
    loadingImages: 'Cargando imágenes…',
    joinTwoFrames: 'Uní al menos dos cuadros en la línea de tiempo',
    noCommonTimes: 'Las capas no tienen horarios en común',
    playing: 'Reproduciéndose',
    timeline: 'Línea de tiempo',
    timelineAria: 'Ver y editar la línea de tiempo del grupo',
    syncedLayers: (count: number): string => `${count} capas sincronizadas`,
    groupLayers: 'Capas del grupo',
    notSynced: 'Sin sincronizar',
    emptyTitle: 'Nada para sincronizar',
    emptyHint: 'Encendé radares, satélites o modelos numéricos para animarlos juntos.',
  },
} as const;
