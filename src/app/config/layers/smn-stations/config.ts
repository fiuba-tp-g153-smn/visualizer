import {
  ActiveLayerGroupId,
  LayerCategory,
  LayerScale,
  LayerType,
  ScaleType,
} from '../../../models';
import { SMN_UNITS, TEMPERATURE_UNITS } from '../../../constants';
import { LayerSelectionMode, LayerSubgroup } from '../../../models/layers/groups.models';
import { SMN_WEATHER_SCALE_STEPS } from './render.config';

import { SmnStationLayer } from '../../../models/layers/models';

export const SMN_STATION_PANE = 'smn-station-pane';
// Fallback z-index; MapLayersService sets this dynamically per active-layer order.
export const SMN_STATION_PANE_Z_INDEX = '560';

const TEMPERATURE_SCALE: LayerScale = {
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

const FEELS_LIKE_SCALE: LayerScale = {
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

const HUMIDITY_SCALE: LayerScale = {
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

const PRESSURE_SCALE: LayerScale = {
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

const VISIBILITY_SCALE: LayerScale = {
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

const WIND_SPEED_SCALE: LayerScale = {
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

const WEATHER_SCALE: LayerScale = {
  type: ScaleType.DISCRETE,
  unit: '',
  steps: SMN_WEATHER_SCALE_STEPS,
};

function createStationLayer(
  id: string,
  name: string,
  description: string,
  variable: SmnStationLayer['variable'],
  scale: LayerScale,
): SmnStationLayer {
  return {
    id,
    name,
    description,
    type: LayerType.VECTOR,
    category: LayerCategory.SMN_STATIONS,
    zIndexGroup: ActiveLayerGroupId.BASE,
    variable,
    scale,
  };
}

export const SMN_STATIONS_SUBGROUP: LayerSubgroup = {
  id: 'smn-stations-current',
  name: 'Estaciones convencionales',
  description: 'Variables actuales de las estaciones convencionales del SMN',
  expanded: false,
  selectionMode: LayerSelectionMode.SINGLE,
  layers: [
    createStationLayer(
      'smn/stations/temperature',
      'Temperatura',
      'Temperatura observada en estaciones meteorológicas del SMN',
      'temperature',
      TEMPERATURE_SCALE,
    ),
    createStationLayer(
      'smn/stations/feels-like',
      'Sensación térmica',
      'Sensación térmica observada en estaciones meteorológicas del SMN',
      'feels_like',
      FEELS_LIKE_SCALE,
    ),
    createStationLayer(
      'smn/stations/humidity',
      'Humedad',
      'Humedad observada en estaciones meteorológicas del SMN',
      'humidity',
      HUMIDITY_SCALE,
    ),
    createStationLayer(
      'smn/stations/pressure',
      'Presión',
      'Presión observada en estaciones meteorológicas del SMN',
      'pressure',
      PRESSURE_SCALE,
    ),
    createStationLayer(
      'smn/stations/visibility',
      'Visibilidad',
      'Visibilidad observada en estaciones meteorológicas del SMN',
      'visibility',
      VISIBILITY_SCALE,
    ),
    createStationLayer(
      'smn/stations/wind-speed',
      'Viento',
      'Intensidad del viento observada en estaciones meteorológicas del SMN',
      'wind_speed',
      WIND_SPEED_SCALE,
    ),
    createStationLayer(
      'smn/stations/weather',
      'Tiempo presente',
      'Estado del tiempo observado en estaciones meteorológicas del SMN',
      'weather',
      WEATHER_SCALE,
    ),
  ],
};
