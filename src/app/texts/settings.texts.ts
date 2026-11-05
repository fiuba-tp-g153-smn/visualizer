/** Texts for the general settings panel. */
export const SETTINGS_TEXTS = {
  tabs: {
    units: 'Unidades',
    smn: 'SMN',
    shortcuts: 'Atajos',
  },
  temperature: {
    title: 'Temperatura',
    celsius: 'Celsius',
    celsiusHint: 'Mostrar temperaturas en grados Celsius (°C)',
    kelvin: 'Kelvin',
    kelvinHint: 'Mostrar temperaturas en Kelvin (K)',
  },
  windSpeed: {
    title: 'Velocidad del viento',
    kmh: 'km/h',
    kmhHint: 'Mostrar velocidad del viento en km/h',
    knots: 'Nudos',
    knotsHint: 'Mostrar velocidad del viento en nudos',
  },
  timezone: {
    title: 'Zona horaria',
    hoa: 'HOA',
    hoaHint: 'Mostrar fechas y horas en Hora Oficial Argentina (UTC-3)',
    utc: 'UTC',
    utcHint: 'Mostrar fechas y horas en UTC+0',
  },
  precision: {
    title: 'Precisión decimal',
    hint: 'Cantidad de decimales a mostrar (0-3)',
    unit: 'decimales',
  },
  apiKey: {
    title: 'API Key estaciones SMN',
    change: 'Cambiar API Key',
    clear: 'Borrar API Key',
    set: 'Configurar API Key',
  },
  shortcuts: {
    title: 'A desarrollar',
    description: 'Configuración de atajos de teclado personalizados.',
  },
} as const;
