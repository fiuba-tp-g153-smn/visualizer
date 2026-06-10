import { WEATHER_STATION_UNITS, TEMPERATURE_UNITS } from '../../../constants';
import { buildScaleFromThresholds } from '../scale-builders';

// Temperatura: -45 °C a 50 °C (stops cada 10 °C, en Kelvin; piso extendido a -45).
export const TEMPERATURE_SCALE = buildScaleFromThresholds({
  unit: TEMPERATURE_UNITS.KELVIN,
  scaleDisplayName: 'Temperatura',
  stops: [
    { value: 228.15, color: '#021026' }, // -45 °C (piso, azul casi negro)
    { value: 233.15, color: '#041a3a' }, // -40
    { value: 243.15, color: '#08306b' },
    { value: 253.15, color: '#2171b5' },
    { value: 263.15, color: '#6baed6' },
    { value: 273.15, color: '#c6dbef' },
    { value: 283.15, color: '#fee08b' },
    { value: 293.15, color: '#f46d43' },
    { value: 303.15, color: '#d73027' },
    { value: 313.15, color: '#a50026' },
    { value: 323.15, color: '#67000d' },
  ],
  labelValues: [
    228.15, 233.15, 243.15, 253.15, 263.15, 273.15, 283.15, 293.15, 303.15, 313.15, 323.15,
  ],
  labelCount: 11,
  subTickCount: 4,
});

// Sensación térmica: -50 °C a 60 °C (stops cada 10 °C, en Kelvin).
// Rango extendido para capturar wind chill y heat index extremos.
export const FEELS_LIKE_SCALE = buildScaleFromThresholds({
  unit: TEMPERATURE_UNITS.KELVIN,
  scaleDisplayName: 'Sensacion termica',
  stops: [
    { value: 223.15, color: '#010f24' },
    { value: 233.15, color: '#041a3a' },
    { value: 243.15, color: '#08306b' },
    { value: 253.15, color: '#2171b5' },
    { value: 263.15, color: '#6baed6' },
    { value: 273.15, color: '#c6dbef' },
    { value: 283.15, color: '#fee08b' },
    { value: 293.15, color: '#f46d43' },
    { value: 303.15, color: '#d73027' },
    { value: 313.15, color: '#a50026' },
    { value: 323.15, color: '#67000d' },
    { value: 333.15, color: '#3f0013' },
  ],
  labelCount: 12,
  subTickCount: 4,
});

// Humedad: 0–100 % (stops cada 25 %).
export const HUMIDITY_SCALE = buildScaleFromThresholds({
  unit: WEATHER_STATION_UNITS.HUMIDITY,
  scaleDisplayName: 'Humedad relativa',
  stops: [
    { value: 0, color: '#f7fcf0' },
    { value: 25, color: '#c7e9c0' },
    { value: 50, color: '#74c476' },
    { value: 75, color: '#238b45' },
    { value: 100, color: '#00441b' },
  ],
  labelCount: 5,
  subTickCount: 4,
});

// Presión: escala secuencial 600–1050 hPa (frío→cálido). El extremo bajo
// (600–940) cubre la presión de estaciones de gran altura; stops finos cada
// 10 hPa en la banda sinóptica 980–1020 y gruesos (~50–100 hPa) por debajo.
export const PRESSURE_SCALE = buildScaleFromThresholds({
  unit: WEATHER_STATION_UNITS.PRESSURE,
  scaleDisplayName: 'Presion',
  stops: [
    { value: 600, color: '#2c003e' },
    { value: 700, color: '#3b1466' },
    { value: 800, color: '#313695' },
    { value: 900, color: '#4575b4' },
    { value: 940, color: '#74add1' },
    { value: 960, color: '#abd9e9' },
    { value: 980, color: '#e0f3f8' },
    { value: 990, color: '#f1fbe0' },
    { value: 1000, color: '#fff8bf' },
    { value: 1010, color: '#fee090' },
    { value: 1020, color: '#fdae61' },
    { value: 1030, color: '#f46d43' },
    { value: 1040, color: '#e0542e' },
    { value: 1050, color: '#d1495b' },
  ],
  labelValues: [600, 700, 800, 900, 940, 980, 1000, 1020, 1050],
  labelCount: 9,
  subTickCount: 1,
});

// Visibilidad: 0–50 km (6 stops cada 10 km)
export const VISIBILITY_SCALE = buildScaleFromThresholds({
  unit: WEATHER_STATION_UNITS.VISIBILITY,
  scaleDisplayName: 'Visibilidad',
  stops: [
    { value: 0, color: '#5e4fa2' },
    { value: 10, color: '#3288bd' },
    { value: 20, color: '#66c2a5' },
    { value: 30, color: '#abdda4' },
    { value: 40, color: '#e6f598' },
    { value: 50, color: '#fee08b' },
  ],
  labelCount: 6,
  subTickCount: 1,
});

// Viento: 0–120 km/h con refuerzo cromático violeta en 90–120 km/h. El dominio
// se mantiene en km/h (unidad de origen SMN); la leyenda y la etiqueta del marker
// se reexpresan en la unidad elegida por el usuario (nudos por defecto) vía el
// toggle de unidades, sin tocar estos valores.
export const WIND_SPEED_SCALE = buildScaleFromThresholds({
  unit: WEATHER_STATION_UNITS.WIND_SPEED,
  scaleDisplayName: 'Velocidad del viento',
  stops: [
    { value: 0, color: '#1a9850' },
    { value: 15, color: '#66bd63' },
    { value: 30, color: '#a6d96a' },
    { value: 45, color: '#d9ef8b' },
    { value: 60, color: '#fee08b' },
    { value: 75, color: '#fdae61' },
    { value: 90, color: '#7b3294' },
    { value: 95, color: '#6a1b9a' },
    { value: 100, color: '#5e35b1' },
    { value: 105, color: '#512da8' },
    { value: 110, color: '#4527a0' },
    { value: 115, color: '#311b92' },
    { value: 120, color: '#1a237e' },
  ],
  labelValues: [0, 15, 30, 45, 60, 75, 90, 100, 110, 120],
  labelCount: 10,
  subTickCount: 2,
});
