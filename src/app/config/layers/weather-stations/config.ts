import {
  ActiveLayerGroupId,
  LayerCategory,
  LayerScale,
  LayerType,
  WeatherStationLayer,
  WeatherStationVariable,
} from '../../../models';
import { LayerSelectionMode, LayerSubgroup } from '../../../models/layers/groups.models';
import {
  FEELS_LIKE_SCALE,
  HUMIDITY_SCALE,
  PRESSURE_SCALE,
  TEMPERATURE_SCALE,
  VISIBILITY_SCALE,
  WIND_SPEED_SCALE,
} from './scales.config';

export const WEATHER_STATION_PANE = 'weather-station-pane';
// Fallback z-index; MapLayersService sets this dynamically per active-layer order.
export const WEATHER_STATION_PANE_Z_INDEX = '2500';

function createStationLayer(
  id: string,
  name: string,
  description: string,
  variable: WeatherStationLayer['variable'],
  scale: LayerScale,
): WeatherStationLayer {
  return {
    id,
    name,
    description,
    type: LayerType.VECTOR,
    category: LayerCategory.WEATHER_STATIONS,
    zIndexGroup: ActiveLayerGroupId.POINTS,
    variable,
    scale,
  };
}

export const WEATHER_STATIONS_SUBGROUP: LayerSubgroup = {
  id: 'weather-stations-current',
  name: 'Estaciones convencionales',
  description: 'Variables actuales de las estaciones meteorológicas convencionales',
  expanded: false,
  selectionMode: LayerSelectionMode.SINGLE,
  layers: [
    createStationLayer(
      'smn/stations/temperature',
      'Temperatura',
      'Temperatura observada en estaciones meteorológicas',
      WeatherStationVariable.TEMPERATURE,
      TEMPERATURE_SCALE,
    ),
    createStationLayer(
      'smn/stations/feels-like',
      'Sensación térmica',
      'Sensación térmica observada en estaciones meteorológicas',
      WeatherStationVariable.FEELS_LIKE,
      FEELS_LIKE_SCALE,
    ),
    createStationLayer(
      'smn/stations/humidity',
      'Humedad',
      'Humedad relativa observada en estaciones meteorológicas',
      WeatherStationVariable.HUMIDITY,
      HUMIDITY_SCALE,
    ),
    createStationLayer(
      'smn/stations/pressure',
      'Presión',
      'Presión atmosférica observada en estaciones meteorológicas',
      WeatherStationVariable.PRESSURE,
      PRESSURE_SCALE,
    ),
    createStationLayer(
      'smn/stations/visibility',
      'Visibilidad',
      'Visibilidad observada en estaciones meteorológicas',
      WeatherStationVariable.VISIBILITY,
      VISIBILITY_SCALE,
    ),
    createStationLayer(
      'smn/stations/wind-speed',
      'Viento',
      'Intensidad del viento observada en estaciones meteorológicas',
      WeatherStationVariable.WIND_SPEED,
      WIND_SPEED_SCALE,
    ),
  ],
};
