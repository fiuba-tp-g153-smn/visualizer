import { WEATHER_STATION_UNITS, TEMPERATURE_UNITS } from '../../../constants';
import { buildLinearScale } from '../scale-builders';

// Paleta base de temperatura: mismos colores anclados a los mismos °C en ambas escalas.
// Temperatura usa esta paleta completa (-30 a 40 °C).
// Sensación térmica la extiende en ambos extremos (-40 a 50 °C) para cubrir
// wind chill y heat index, manteniendo los 8 colores centrales idénticos.
//   índice 0 → -30 °C   índice 4 → 10 °C
//   índice 1 → -20 °C   índice 5 → 20 °C
//   índice 2 → -10 °C   índice 6 → 30 °C
//   índice 3 →   0 °C   índice 7 → 40 °C
const TEMPERATURE_COLORS = [
  '#08306b', // -30 °C
  '#2171b5', // -20 °C
  '#6baed6', // -10 °C
  '#c6dbef', //   0 °C
  '#fee08b', //  10 °C
  '#f46d43', //  20 °C
  '#d73027', //  30 °C
  '#a50026', //  40 °C
] as const;

// Extensión de la paleta para sensación térmica (-40 a 50 °C, 10 stops cada 10 °C).
// Los 8 colores centrales son exactamente TEMPERATURE_COLORS, así el mismo color
// representa la misma temperatura al comparar ambas capas.
const FEELS_LIKE_COLORS = [
  '#041a3a', // -40 °C  (extensión fría)
  ...TEMPERATURE_COLORS, // -30 °C … 40 °C  (idénticos a TEMPERATURE_COLORS)
  '#67000d', //  50 °C  (extensión caliente)
] as const;

// Temperatura: -30 °C a 40 °C (8 stops cada 10 °C → en Kelvin: 243.15–313.15)
export const TEMPERATURE_SCALE = buildLinearScale({
  min: 243.15,
  max: 313.15,
  unit: TEMPERATURE_UNITS.KELVIN,
  colors: TEMPERATURE_COLORS,
  labelCount: 8,
  subTickCount: 4,
});

// Sensación térmica: -40 °C a 50 °C (10 stops cada 10 °C → en Kelvin: 233.15–323.15)
// Rango extendido para capturar wind chill y heat index extremos.
export const FEELS_LIKE_SCALE = buildLinearScale({
  min: 233.15,
  max: 323.15,
  unit: TEMPERATURE_UNITS.KELVIN,
  colors: FEELS_LIKE_COLORS,
  labelCount: 10,
  subTickCount: 4,
});

// Humedad: 0–100 % (5 stops cada 25 %)
export const HUMIDITY_SCALE = buildLinearScale({
  min: 0,
  max: 100,
  unit: WEATHER_STATION_UNITS.HUMIDITY,
  colors: ['#f7fcf0', '#c7e9c0', '#74c476', '#238b45', '#00441b'],
  labelCount: 5,
  subTickCount: 4,
});

// Presión: 980–1040 hPa (7 stops cada 10 hPa)
export const PRESSURE_SCALE = buildLinearScale({
  min: 980,
  max: 1040,
  unit: WEATHER_STATION_UNITS.PRESSURE,
  colors: ['#313695', '#4575b4', '#abd9e9', '#fee08b', '#f46d43', '#d73027', '#a50026'],
  labelCount: 7,
  subTickCount: 1,
});

// Visibilidad: 0–50 km (6 stops cada 10 km)
export const VISIBILITY_SCALE = buildLinearScale({
  min: 0,
  max: 50,
  unit: WEATHER_STATION_UNITS.VISIBILITY,
  colors: ['#5e4fa2', '#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b'],
  labelCount: 6,
  subTickCount: 1,
});

// Viento: 0–90 km/h (7 stops cada 15 km/h)
export const WIND_SPEED_SCALE = buildLinearScale({
  min: 0,
  max: 90,
  unit: WEATHER_STATION_UNITS.WIND_SPEED,
  colors: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027', '#a50026'],
  labelCount: 7,
  subTickCount: 2,
});
