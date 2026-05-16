import { LayerScale, ScaleType } from '../../../models';
import { SMN_UNITS, TEMPERATURE_UNITS } from '../../../constants';

export const TEMPERATURE_SCALE: LayerScale = {
  type: ScaleType.CONTINUOUS,
  unit: TEMPERATURE_UNITS.KELVIN,
  stops: [
    { value: 243.15, color: '#08306b', label: '243' },
    { value: 258.15, color: '#2171b5', label: '258' },
    { value: 273.15, color: '#6baed6', label: '273' },
    { value: 283.15, color: '#fee08b', label: '283' },
    { value: 293.15, color: '#f46d43', label: '293' },
    { value: 303.15, color: '#d73027', label: '303' },
    { value: 313.15, color: '#a50026', label: '313' },
  ],
};

export const FEELS_LIKE_SCALE: LayerScale = {
  type: ScaleType.CONTINUOUS,
  unit: TEMPERATURE_UNITS.KELVIN,
  stops: [
    { value: 243.15, color: '#2c7bb6', label: '243' },
    { value: 258.15, color: '#abd9e9', label: '258' },
    { value: 273.15, color: '#ffffbf', label: '273' },
    { value: 283.15, color: '#fdae61', label: '283' },
    { value: 293.15, color: '#d7191c', label: '293' },
  ],
};

export const HUMIDITY_SCALE: LayerScale = {
  type: ScaleType.CONTINUOUS,
  unit: SMN_UNITS.HUMIDITY,
  stops: [
    { value: 0, color: '#f7fcf0', label: '0' },
    { value: 25, color: '#c7e9c0', label: '25' },
    { value: 50, color: '#74c476', label: '50' },
    { value: 75, color: '#238b45', label: '75' },
    { value: 100, color: '#00441b', label: '100' },
  ],
};

export const PRESSURE_SCALE: LayerScale = {
  type: ScaleType.CONTINUOUS,
  unit: SMN_UNITS.PRESSURE,
  stops: [
    { value: 980, color: '#313695', label: '980' },
    { value: 995, color: '#4575b4', label: '995' },
    { value: 1010, color: '#74add1', label: '1010' },
    { value: 1025, color: '#fdae61', label: '1025' },
    { value: 1040, color: '#a50026', label: '1040' },
  ],
};

export const VISIBILITY_SCALE: LayerScale = {
  type: ScaleType.CONTINUOUS,
  unit: SMN_UNITS.VISIBILITY,
  stops: [
    { value: 0, color: '#5e4fa2', label: '0' },
    { value: 1, color: '#3288bd', label: '1' },
    { value: 2, color: '#66c2a5', label: '2' },
    { value: 5, color: '#abdda4', label: '5' },
    { value: 10, color: '#e6f598', label: '10' },
    { value: 20, color: '#fee08b', label: '20' },
    { value: 50, color: '#f46d43', label: '50' },
  ],
};

export const WIND_SPEED_SCALE: LayerScale = {
  type: ScaleType.CONTINUOUS,
  unit: SMN_UNITS.WIND_SPEED,
  stops: [
    { value: 0, color: '#1a9850', label: '0' },
    { value: 15, color: '#91cf60', label: '15' },
    { value: 30, color: '#d9ef8b', label: '30' },
    { value: 45, color: '#fee08b', label: '45' },
    { value: 60, color: '#fc8d59', label: '60' },
    { value: 90, color: '#d73027', label: '90' },
  ],
};

