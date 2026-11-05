/** Texts for weather stations: map popup, history charts, API key dialog. */
export const STATIONS_TEXTS = {
  stationId: 'ID estación:',
  coords: (lat: string, lon: string): string => `Lat ${lat} · Lon ${lon}`,
  defaultName: 'Estación',
  /** Display names of the observed variables (popup, charts, summary). */
  variables: {
    temperature: 'Temperatura',
    feelsLike: 'Sensación térmica',
    dewPoint: 'Punto de rocío',
    humidity: 'Humedad',
    pressure: 'Presión',
    visibility: 'Visibilidad',
    wind: 'Viento',
  },
  stats: {
    max: 'Máxima',
    min: 'Mínima',
    avg: 'Promedio',
  },
  staleTooltip: 'Sin datos en el período solicitado',
  apiKey: {
    invalidReprompt: 'Tu clave ya no es válida. Ingresá una nueva para continuar.',
    expiredPrompt:
      'Tu clave ya no funciona. Pedile una nueva al administrador del sistema y pegala acá.',
    rejected: 'No se pudieron cargar las estaciones meteorológicas: tu clave no es válida.',
  },
  wind: {
    calmCaption: 'Calma · sin dirección',
    from: (direction: string): string => `desde el ${direction}`,
    noData: 'Sin dato',
  },
  popup: {
    currentTab: 'Actual',
    graphTab: 'Gráfico',
    feelsLike: (value: string): string => `Sensación ${value}`,
    dewPoint: 'Punto de rocío',
    updated: (when: string): string => `Actualizado: ${when}`,
    noData: 'Sin datos en las últimas 48 h.',
    loading: 'Cargando…',
    chartError: 'No se pudo cargar el gráfico.',
    viewAll: 'Ver todas las variables y gráficos',
  },
  history: {
    subtitle: 'Últimas 48 horas',
    chartsTab: 'Gráficos',
    summaryTab: 'Resumen',
    observationsTab: 'Observaciones',
    loading: 'Cargando histórico…',
    error: 'No se pudo cargar el histórico de la estación.',
    noData: 'Sin datos en las últimas 48 horas.',
    chartNoData: 'Sin datos',
    columns: {
      time: 'Hora',
      temperature: 'Temp.',
      dewPoint: 'P. rocío',
      humidity: 'Humedad',
      windDirection: 'Viento',
      windSpeed: 'Velocidad',
      pressure: 'Presión',
      visibility: 'Visib.',
      condition: 'Condición',
    },
  },
  apiKeyDialog: {
    title: 'Clave de acceso a las estaciones meteorológicas',
    description:
      'Ingresá la clave de acceso al servicio de estaciones del SMN. Se guarda en el navegador.',
    keyLabel: 'Clave',
    invalidKey: 'La clave ingresada no es válida. Verificá que sea correcta e intentá de nuevo.',
  },
} as const;
