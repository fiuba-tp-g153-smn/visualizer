import { WEATHER_STATION_UNITS, TEMPERATURE_UNITS } from '../../../constants';
import { buildScaleFromLinearGradient } from '../scale-builders';

export const TEMPERATURE_SCALE = buildScaleFromLinearGradient({
  min: 243.15,
  max: 313.15,
  unit: TEMPERATURE_UNITS.KELVIN,
  scaleDisplayName: 'Temperatura',
  colors: ['#08306b', '#2171b5', '#6baed6', '#fee08b', '#f46d43', '#d73027', '#a50026'],
});

export const FEELS_LIKE_SCALE = buildScaleFromLinearGradient({
  min: 243.15,
  max: 293.15,
  unit: TEMPERATURE_UNITS.KELVIN,
  scaleDisplayName: 'Sensacion termica',
  colors: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'],
});

export const HUMIDITY_SCALE = buildScaleFromLinearGradient({
  min: 0,
  max: 100,
  unit: WEATHER_STATION_UNITS.HUMIDITY,
  scaleDisplayName: 'Humedad relativa',
  colors: ['#f7fcf0', '#c7e9c0', '#74c476', '#238b45', '#00441b'],
});

export const PRESSURE_SCALE = buildScaleFromLinearGradient({
  min: 980,
  max: 1040,
  unit: WEATHER_STATION_UNITS.PRESSURE,
  scaleDisplayName: 'Presion',
  colors: ['#313695', '#4575b4', '#74add1', '#fdae61', '#a50026'],
});

export const VISIBILITY_SCALE = buildScaleFromLinearGradient({
  min: 0,
  max: 50,
  unit: WEATHER_STATION_UNITS.VISIBILITY,
  scaleDisplayName: 'Visibilidad',
  colors: ['#5e4fa2', '#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#f46d43'],
});

export const WIND_SPEED_SCALE = buildScaleFromLinearGradient({
  min: 0,
  max: 90,
  unit: WEATHER_STATION_UNITS.WIND_SPEED,
  scaleDisplayName: 'Velocidad del viento',
  colors: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027'],
});
