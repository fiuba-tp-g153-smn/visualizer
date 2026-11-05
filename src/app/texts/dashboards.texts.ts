/** Texts for the status dashboards: processing jobs, alerts jobs, data and base maps. */
export const DASHBOARDS_TEXTS = {
  /** Header controls and states shared by every status page. */
  page: {
    connecting: 'Conectando…',
    window: 'ventana',
    interval: 'intervalo',
    hour: 'hora',
    day: 'día',
    all: 'todo',
    refreshEvery: 'Actualización cada',
    off: 'no',
    refreshHint: "Frecuencia del refresco automático. 'no' lo desactiva.",
    refresh: 'Actualizar',
    refreshNowHint: 'Refresca los datos ahora.',
    updated: (at: string): string => `Actualizado ${at}`,
    metricsError: (error: string): string => `No se pudieron actualizar las métricas: ${error}`,
    retry: 'Reintentar',
    loadingMetrics: 'Cargando métricas…',
    range: 'rango',
    custom: 'personalizado',
    customHours: 'Horas personalizadas',
    total: 'Total',
    byType: 'Por tipo',
    allFilter: 'todos',
  },
  processing: {
    offline: 'Servicio de métricas sin conexión',
    online: 'Servicio de métricas operativo',
    title: 'Panel de rendimiento y estado del procesamiento (tiles processor)',
    windowHint:
      'Ventana de tiempo de los datos mostrados (24h, 7 días o todo el histórico). Aplica a todos los paneles, salvo los que tienen su propio rango.',
    intervalHint:
      'Intervalo con que se agrupan los gráficos de tendencias y throughput: por hora o por día.',
    refreshHint:
      "Frecuencia del refresco automático de los datos. 'no' desactiva el auto-refresco.",
    summary: 'Resumen general',
    summaryTip:
      'Totales del período seleccionado (ventana): trabajos finalizados, tasa de éxito, fallos, descartes (DLQ), reencolados y omitidos, más la cantidad de tipos de trabajo activos.',
    queues: 'Colas · RabbitMQ',
    queuesTip:
      "Trabajos esperando para procesarse: el total en espera y su desglose entre la cola de trabajo general (GOES/GLM) y la ligera, que a su vez se abre en radar y WRF (colas separadas para que no se bloqueen entre sí). 'Descartes (DLQ)' son los que cayeron tras agotar los reintentos. 'N/A' si RabbitMQ no responde.",
    inProgress: 'Trabajos en proceso',
    inProgressTip:
      'Trabajos que los workers están procesando ahora mismo, según el rastreador de progreso (SQLite). Es independiente de RabbitMQ.',
    throughput10: 'Throughput · cada 10 min',
    throughput10Tip:
      'Evolución del throughput en una ventana corta con intervalos de 10 minutos: trabajos finalizados por cada bloque de 10 min y por tipo de trabajo. Útil para ver picos y huecos recientes que la vista por hora suaviza.',
    throughputMode: 'Modo de throughput',
    noJobsInRange: 'Sin trabajos en este rango.',
    timeline: 'Línea de tiempo de trabajos',
    timelineTip:
      "Cada unidad como una barra desde que un worker la toma (inicio) hasta que termina (fin). Las filas solo evitan que las barras se solapen (no son los workers); su cantidad es la concurrencia máxima. Los rangos fijos (6h…7d) traen TODAS las unidades de la ventana; 'todo' arranca en la última semana y carga las semanas anteriores al desplazarte (vista máx. 7 días). Arrastrá sobre el gráfico para seleccionar un rango y acercar; rueda para zoom; arrastrá el slider inferior para desplazarte en el tiempo. Botones arriba a la derecha: volver al zoom anterior y ver todo. Color por resultado o por tipo (toggle); clic en una barra para ver el detalle; el worker está en el tooltip. Las horas siguen el huso configurado.",
    timelineError: (error: string): string => `No se pudo cargar la línea de tiempo: ${error}`,
    loadingTimeline: 'Cargando línea de tiempo…',
    byJobType: 'Rendimiento por tipo de trabajo',
    byJobTypeTip:
      'Por cada tipo de trabajo: cuántos se procesaron, cuántos fallaron (% error) y cuánto tardaron (prom/mín/máx/p95, solo sobre los exitosos), con el desglose por etapa. Este panel tiene su propio rango (24h por defecto), independiente de la ventana global. Clic en una columna para ordenar; clic en una fila para ver el detalle completo.',
    trends: 'Tendencias de tiempos',
    trendsTip:
      'Cómo evolucionan los tiempos de procesamiento a lo largo del tiempo, agrupados por intervalo (hora/día) y tipo de trabajo. Se calculan solo sobre trabajos exitosos.',
    recent: 'Trabajos recientes',
    recentTip:
      "Últimos trabajos finalizados (todos los resultados), del más nuevo al más viejo. Clic en las columnas para ordenar; clic en una fila para ver el detalle; 'cargar más' trae las siguientes 50 filas.",
    outcomeFilter: 'resultado',
    typeFilter: 'tipo',
  },
  cache: {
    offline: 'Caché sin conexión',
    online: 'Caché operativo',
    title: 'Estado del sistema de caché (data service)',
    windowHint:
      'Ventana de tiempo de las series históricas (memoria, throughput, errores, ciclos). No afecta a los estados/snapshots en vivo.',
    intervalHint: 'Intervalo de agrupación de las series de sincronización: por hora o por día.',
    summary: 'Resumen general',
    info: 'Redis · INFO',
    syncStatus: 'Estado de sincronización',
    memory: 'Memoria Redis por dominio',
    noMemorySamples: 'Sin muestras de memoria todavía.',
    memoryHistory: 'Evolución de memoria Redis',
    noMemoryHistory: 'Sin historial de memoria en esta ventana.',
    throughput10: 'Throughput de sync · cada 10 min',
    throughputMode: 'Modo de throughput de sync',
    noCyclesInRange: 'Sin ciclos de sync en este rango.',
    throughput: 'Throughput de sincronización',
    noCyclesInWindow: 'Sin ciclos de sync en esta ventana.',
    errors: 'Errores de sincronización',
    timeline: 'Línea de tiempo de sincronización',
    timelineTypeLabel: 'dominio',
    cycles: 'Ciclos recientes',
    sampled: (ago: string): string => `muestreado ${ago}`,
    cycleTip: {
      start: 'Inicio',
      end: 'Fin',
      duration: 'Duración',
      downloaded: 'Descargados',
      errors: 'Errores',
      outcome: 'Resultado',
    },
    /** Panel tooltips: what it shows · where from · how often. */
    tips: {
      summary:
        'Estado de un vistazo.\n' +
        '• Memoria y claves: colector de Redis, ~15 min\n' +
        '• Sync (ciclos, fallos): hash sync:status, ~60 s',
      syncStatus:
        'Último ciclo de cada dominio (tabla sync_cycles).\n' +
        '• Tiles S3→Redis (sat/radar/ECMWF/WRF): ~60 s\n' +
        '• Estaciones (SMN): ~5 min · Mapa base: ~7 días\n' +
        '• "descargado" = ítems nuevos del ciclo',
      memory:
        'Qué está llenando Redis.\n' +
        '• SCAN + MEMORY USAGE por prefijo de clave, ~15 min\n' +
        '• Lo llenan tiles (~60 s) y estaciones (~5 min)\n' +
        '• Mapa base (backup_only): escribe S3, ≈ 0 en Redis',
      memoryHistory:
        'Crecimiento de memoria por dominio (área apilada).\n' +
        '• Tabla redis_memory_samples\n' +
        '• 1 punto cada ~15 min · retención 14 días\n' +
        '• Sigue la ventana e intervalo',
      throughput:
        'Ítems descargados por intervalo y dominio.\n' +
        '• Agrega sync_cycles por bucket (hora/día)\n' +
        '• Tiles S3→Redis, obs. del SMN, tiles de mapa base',
      throughput10:
        'Ítems descargados en buckets de 10 minutos (ventana corta).\n' +
        '• "Total" agrega todos los dominios; "Por tipo" abre uno por dominio\n' +
        '• Rango propio (1–12 h o personalizado), independiente de la ventana global',
      errors:
        'Errores por intervalo y dominio.\n' +
        '• Agrega sync_cycles por bucket\n' +
        '• Picos sostenidos = problema persistente (S3, SMN, providers)',
      info:
        'Redis INFO + DBSIZE, ~15 min.\n' +
        '• Fragmentación = RSS ÷ used_memory\n' +
        '• Hit rate = hits ÷ (hits + misses)\n' +
        '• Desalojadas > 0 = descartando datos por memoria',
      cycles:
        'Filas crudas de sync_cycles (más nuevas primero, máx. 100).\n' +
        '• El detalle sin agregar detrás de throughput y errores',
      timeline:
        'Cada ciclo de sync como una barra (inicio → fin), apilado en filas sin solaparse.\n' +
        '• Color por dominio (toggle a resultado); las filas son concurrencia, no workers\n' +
        '• Rango 6h…7d + "todo" con carga perezosa al desplazarte; rueda/arrastre = zoom\n' +
        '• Se carga al cambiar el rango (no en el auto-refresh, para no perder el zoom)',
    },
  },
  basemap: {
    offline: 'Mapa base sin conexión',
    online: 'Mapa base operativo',
    title: 'Scraper de respaldo de mapa base (data service)',
    updateError: (error: string): string => `No se pudo actualizar el estado del scraper: ${error}`,
    loading: 'Cargando estado del scraper…',
    panel: 'Scraper de mapa base',
    panelTip:
      'Estado en vivo del scraper de mapa base (SQLite propio).\n' +
      '• respaldado · respaldando (cursor z·índice) · con errores\n' +
      '• respaldado % y fallidos = del último barrido (ok / intentos)\n' +
      '• "con errores" = pausado: la tasa de error superó el umbral\n' +
      '• Barrido completo cada ~7 días (backup_only → S3)',
    lastSweep: (ago: string): string => `último barrido ${ago}`,
  },
  alerts: {
    offline: 'Servicio de alertas sin conexión',
    online: 'Servicio de alertas operativo',
    title: 'Estado de generación de alertas (alerts service)',
    windowHint: 'Ventana de tiempo de los datos mostrados (24h, 7 días o todo el histórico).',
    summary: 'Resumen',
    summaryTip: 'Totales de generación de avisos y salud del procesador en la ventana.',
    avgStages: 'Tiempo promedio por etapa',
    avgStagesTip:
      'Promedio de cada etapa de generación (intersección, filtrado, render, guardado) en la ventana.',
    noStages: 'Sin datos de etapas en la ventana.',
    timeline: 'Línea de tiempo de trabajos',
    timelineTip:
      'Cada alerta es una barra sobre su duración. Rueda para zoom, arrastrá para seleccionar un rango, clic en una barra para el desglose por etapa.',
    timelineTypeLabel: 'fenómeno',
    activity: 'Actividad',
    activityTip: 'Alertas generadas con éxito vs. fallidas por intervalo de tiempo.',
    noActivity: 'Sin actividad en el rango.',
    failures: 'Fallos por motivo',
    failuresTip:
      'Desglose de los trabajos fallidos por código de error. Clic en un encabezado para ordenar.',
    noFailures: 'Sin fallos en la ventana.',
    recent: 'Trabajos recientes',
    recentTip:
      'Últimas alertas generadas. Clic en un encabezado para ordenar, o en una fila para ver el desglose por etapa.',
    noJobs: 'Sin trabajos en la ventana.',
    /** Human labels for the backend `error_code` values. */
    errorCodes: {
      timeout: 'Tiempo de generación agotado',
      area_too_large: 'Área afectada demasiado grande',
      generation_failed: 'Error de generación',
      unknown: 'Desconocido',
    },
    series: {
      success: 'Exitosas',
      failed: 'Fallidas',
    },
    cards: {
      generated: 'Alertas generadas',
      generatedHint: 'Alertas finalizadas en la ventana (exitosas + fallidas).',
      success: 'Exitosas',
      successHint: 'Alertas generadas correctamente (intersección + GIFs + guardado).',
      failed: 'Fallidas',
      failedHint: 'Alertas que terminaron en error (ver desglose por motivo).',
      successRate: 'Tasa de éxito',
      successRateHint: 'Exitosas ÷ (exitosas + fallidas) en la ventana.',
      avgDuration: 'Duración prom.',
      avgDurationHint: 'Duración media de las alertas generadas con éxito.',
      p95Duration: 'Duración p95',
      p95DurationHint: 'Percentil 95 de la duración de las alertas exitosas.',
      workers: 'Workers',
      workersHint: 'Workers activos del procesador (último muestreo).',
      pending: 'Pendientes',
      pendingHint: 'Avisos generados que aún no se sincronizaron a la tabla activa.',
    },
    columns: {
      reason: 'Motivo',
      count: 'Cantidad',
      time: 'Hora',
      phenomenon: 'Fenómeno',
      outcome: 'Resultado',
      departments: 'Deptos.',
      duration: 'Duración',
    },
    tooltip: {
      duration: (value: string): string => `Duración: ${value}`,
      outcome: (value: string): string => `Resultado: ${value}`,
    },
    phenomenonFallback: (code: number): string => `Fenómeno ${code}`,
  },
  status: {
    back: 'Volver',
    goToMap: 'Ir al mapa',
    tabsAria: 'Paneles de estado',
    tabs: {
      processing: 'Procesamiento',
      cache: 'Caché',
      basemap: 'Mapas base',
      alerts: 'Alertas',
    },
  },
  docs: {
    title: 'Documentación',
    loading: 'Cargando documentación...',
  },
  common: {
    close: 'Cerrar',
    stageBreakdown: 'Desglose por etapa',
    noData: 'Sin datos',
    notAvailable: 'N/A',
  },
  jobs: {
    noJobsYet: 'Aún no hay trabajos registrados.',
    loadMore: 'cargar 50 más',
    loadedCount: (count: number): string => `${count} cargados`,
    sortHint: '(el orden aplica a las filas cargadas)',
    columns: {
      finished: 'finalizado',
      job: 'trabajo',
      scene: 'escena',
      outcome: 'resultado',
      total: 'total',
      download: 'descarga',
      node: 'nodo',
      detail: 'detalle',
    },
    detail: {
      image: 'Imagen',
      scene: 'Escena',
      workUnit: 'Work unit',
      dataSource: 'Fuente de datos',
      processor: 'Procesador',
      band: 'Banda',
      type: 'Tipo',
      node: 'Nodo',
      start: 'Inicio',
      end: 'Fin',
      total: 'Total',
      download: 'Descarga',
      process: 'Proceso',
      retries: 'Reintentos',
    },
  },
  jobTypes: {
    columns: {
      type: 'tipo de trabajo',
      n: 'n',
      outcomes: 'resultados',
      errorRate: '% error',
      avg: 'prom',
      min: 'mín',
      max: 'máx',
      p95: 'p95',
      download: 'descarga',
      stages: 'desglose por etapa',
      last: 'último',
    },
    detail: {
      jobs: 'Trabajos',
      errorRate: '% error',
      avg: 'Prom',
      min: 'Mín',
      max: 'Máx',
      p95: 'p95',
      download: 'Descarga',
      last: 'Último',
    },
  },
  inProgress: {
    title: 'en proceso',
    columns: {
      image: 'imagen',
      band: 'banda',
      status: 'estado',
      since: 'desde',
    },
    empty: 'No hay trabajos en proceso.',
  },
  queues: {
    totalWaiting: 'total en espera',
    generalPlusLight: 'general + ligera',
    generalQueue: 'cola de trabajo general',
    waiting: 'en espera',
    lightQueue: 'cola de trabajo ligera',
    radarPlusWrf: 'radar + WRF',
    lightRadar: 'cola ligera · radar',
    lightWrf: 'cola ligera · WRF',
    dlq: 'descartes (DLQ)',
    messages: 'mensajes',
    offline: 'Sin conexión con RabbitMQ — reintentando…',
  },
  statCards: {
    finished: 'Trabajos finalizados',
    finishedHint:
      'Total de trabajos finalizados en la ventana (éxitos + fallos + reencolados + omitidos). Se cuenta por intento.',
    successes: 'Éxitos',
    successesHint:
      'Trabajos que completaron el procesamiento correctamente (tiles generados y subidos).',
    failures: 'Fallos',
    failuresHint: (errors: number, dlq: number): string =>
      `Trabajos que fallaron con una excepción: errores (${errors}) + descartes DLQ (${dlq}). El DLQ es un subconjunto de Fallos.`,
    skipped: 'Omitidos',
    skippedHint:
      'Trabajos omitidos porque el dato aún no estaba disponible; se reintentan en el próximo ciclo. No son fallos.',
    successRate: 'Tasa de éxito',
    successRateHint: (successes: number, base: number, rate: string): string =>
      `${successes} éxitos ÷ ${base} (éxitos + fallos + omitidos) = ${rate}. Excluye reencolados (reintentos transitorios).`,
    noJobsInWindow: 'Sin trabajos en la ventana.',
    dlq: 'Descartes (DLQ)',
    dlqHint:
      'Trabajos que agotaron los reintentos y fueron a la cola de descartes (fallos terminales que requieren atención).',
    requeued: 'Reencolados',
    requeuedHint:
      'Trabajos reencolados por un error transitorio de descarga para reintentarse. No son fallos.',
    types: 'Tipos',
    typesHint: (lines: string): string => `Tipos de trabajo activos:\n${lines}`,
    noTypes: 'Sin tipos activos.',
  },
  trends: {
    evolution: 'Evolución de tiempos',
    evolutionHint:
      'Tiempo total promedio (descarga + procesamiento) por tipo de trabajo en cada intervalo.',
    evolutionSub: 'tiempo total promedio por tipo de trabajo',
    throughput: 'Throughput',
    throughputHint:
      'Cantidad de trabajos finalizados por intervalo, apilados por tipo de trabajo (incluye todos los resultados).',
    throughputSub: 'trabajos finalizados por intervalo (apilado)',
    stagesHint:
      'Segundos promedio en cada etapa del pipeline (georref., COG, teselado, subida, etc.) para el tipo de trabajo seleccionado.',
    stagesSub: 'segundos promedio por etapa ·',
    p95: 'Latencia p95',
    p95Hint:
      'Percentil 95 del tiempo total por tipo: detecta regresiones de cola (los peores casos) que el promedio oculta.',
    p95Sub: 'tiempo total p95 por tipo',
    noSuccesses: 'Aún no hay trabajos exitosos en esta ventana.',
  },
  stagePie: {
    includeDownload: 'Incluir descarga',
    processingOnly: 'Solo procesamiento',
    empty: 'Sin desglose disponible.',
  },
  timeline: {
    colorByType: (typeLabel: string): string => `Color: ${typeLabel}`,
    colorByOutcome: 'Color: resultado',
    defaultTypeLabel: 'tipo',
    zoomBack: 'Volver al zoom anterior',
    zoomAll: 'Ver todo',
    empty: 'Sin trabajos en este rango.',
  },
  data: {
    loadMore: 'cargar 50 más',
    loadedCount: (count: number): string => `${count} cargados`,
    sortHint: '(el orden aplica a las filas cargadas)',
    outcomes: {
      ok: 'ok',
      error: 'error',
    },
    columns: {
      finished: 'finalizado',
      domain: 'dominio',
      downloaded: 'descargado',
      errors: 'errores',
      duration: 'duración',
      outcome: 'resultado',
      lastCycle: 'último ciclo',
    },
    noCyclesInWindow: 'Sin ciclos en la ventana seleccionada.',
    noCyclesYet: 'Sin ciclos de sync registrados todavía.',
    cards: {
      redisMemory: 'Memoria Redis usada',
      redisMemoryHint:
        'Memoria total reportada por Redis (INFO used_memory).\nFuente: colector de Redis, muestra cada ~15 min.',
      totalKeys: 'Claves totales',
      totalKeysHint: 'Cantidad de claves en Redis (DBSIZE).\nFuente: colector de Redis, ~15 min.',
      topConsumer: 'Mayor consumidor',
      topConsumerHint:
        'Dominio que más memoria consume y cuántos bytes ocupa.\nFuente: SCAN + MEMORY USAGE por prefijo de clave, ~15 min.',
      domainMemory: 'Memoria por dominios',
      domainMemoryHint:
        'Suma de MEMORY USAGE sobre todas las claves, agrupada por dominio (≈ used_memory, sin el overhead interno de Redis).\nFuente: colector de Redis, ~15 min.',
      syncDomains: 'Dominios de sync',
      syncDomainsList: (lines: string): string =>
        `Dominios con al menos un ciclo registrado (tabla sync_cycles):\n${lines}`,
      syncDomainsHint:
        'Dominios con al menos un ciclo registrado en la tabla sync_cycles (SQLite).',
      consecutiveFailures: 'Fallos consecutivos',
      consecutiveFailuresHint:
        'Ciclos con errores seguidos del loop de sync (0 = saludable).\nFuente: hash sync:status en Redis.',
      lastSync: 'Último sync',
      lastSyncHint:
        'Hace cuánto terminó el ciclo más reciente de cualquier dominio.\nFuente: tabla sync_cycles.',
    },
    redisInfo: {
      empty: 'Sin snapshot de Redis INFO todavía.',
      usedMemory: 'used_memory',
      usedMemoryHint: 'Memoria asignada por Redis a su dataset (INFO used_memory).',
      rss: 'RSS',
      rssHint: 'Memoria física reservada por el SO para el proceso Redis (used_memory_rss).',
      peak: 'Max alcanzado',
      peakHint: 'Máximo histórico de used_memory desde el arranque (used_memory_peak).',
      maxmemory: 'maxmemory',
      unlimited: 'sin límite',
      maxmemoryHint: 'Tope de memoria configurado (0 = sin límite).',
      fragmentation: 'Fragmentación',
      fragmentationHint:
        'mem_fragmentation_ratio = RSS / used_memory. ~1.0 es ideal; >1.5 indica fragmentación alta.',
      evicted: 'Claves desalojadas',
      evictedHint:
        'Claves desalojadas por presión de memoria (evicted_keys). >0 indica que Redis está descartando datos.',
      hitRate: 'Hit rate',
      hitRateHint:
        'keyspace_hits / (hits + misses): proporción de lecturas que encontraron la clave.',
      clients: 'Clientes',
      clientsHint: 'Conexiones de cliente activas (connected_clients).',
    },
    redisMemory: {
      domain: 'dominio',
      memory: 'memoria',
      share: '% del total',
      keys: 'claves',
      total: 'Total',
      empty: 'Sin muestras de memoria todavía (el colector corre cada ~15 min).',
    },
  },
  basemapProviders: {
    states: {
      backed: 'respaldado',
      backing: 'respaldando',
      pending: 'pendiente',
      errors: 'con errores',
    },
    noSweeps: 'Sin barridos registrados todavía.',
    sweepTip: (ok: string, attempted: string): string => `${ok} ok de ${attempted} intentos`,
    incompleteSweep: ' (barrido incompleto)',
    ofAttempts: (attempted: string): string => `de ${attempted} intentos`,
    columns: {
      provider: 'provider',
      state: 'estado',
      backed: 'respaldado',
      failed: 'fallidos',
      trips: 'trips',
      cursor: 'cursor',
      zooms: 'zooms',
      lastCompleted: 'último completado',
    },
    empty: 'El scraper de basemap no está activo (o no hay providers).',
    cards: {
      backed: 'Respaldado',
      backedHint: 'ok / intentos del último barrido, sumado sobre todos los providers.',
      failedTiles: 'Tiles fallidos',
      failedTilesHint:
        'Tiles que fallaron sobre el total de intentos del último barrido (ok + fallidos), sumado sobre todos los providers.',
      providers: 'Providers',
      providersHint: 'Providers de mapa base configurados.',
      withErrors: 'Con errores',
      withErrorsHint: 'Providers con el circuito abierto (su tasa de error superó el umbral).',
    },
  },
  alertJob: {
    ok: 'OK',
    failed: 'Falló',
    images: 'Imágenes',
    areaImage: 'Imagen del área',
    areaImageTitle: (phenomenon: string): string => `${phenomenon} — área`,
    generalImage: 'Imagen general',
    generalImageTitle: (phenomenon: string): string => `${phenomenon} — general`,
    rows: {
      phenomenon: 'Fenómeno',
      departments: 'Departamentos',
      vertices: 'Vértices',
      totalDuration: 'Duración total',
      intersection: 'Intersección',
      departmentFilter: 'Filtrado deptos.',
      render: 'Render (GIF)',
      persist: 'Guardado',
    },
  },
} as const;
