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
import { LAYER_NAMES } from '../../../texts';

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
  name: LAYER_NAMES.weatherStations.weatherStationsCurrent.name,
  description: LAYER_NAMES.weatherStations.weatherStationsCurrent.description,
  expanded: false,
  selectionMode: LayerSelectionMode.SINGLE,
  layers: [
    createStationLayer(
      'weather-stations/temperature',
      LAYER_NAMES.weatherStations.temperature.name,
      LAYER_NAMES.weatherStations.temperature.description,
      WeatherStationVariable.TEMPERATURE,
      TEMPERATURE_SCALE,
    ),
    createStationLayer(
      'weather-stations/dew-point',
      LAYER_NAMES.weatherStations.dewPoint.name,
      LAYER_NAMES.weatherStations.dewPoint.description,
      WeatherStationVariable.DEW_POINT,
      TEMPERATURE_SCALE,
    ),
    createStationLayer(
      'weather-stations/feels-like',
      LAYER_NAMES.weatherStations.feelsLike.name,
      LAYER_NAMES.weatherStations.feelsLike.description,
      WeatherStationVariable.FEELS_LIKE,
      FEELS_LIKE_SCALE,
    ),
    createStationLayer(
      'weather-stations/humidity',
      LAYER_NAMES.weatherStations.humidity.name,
      LAYER_NAMES.weatherStations.humidity.description,
      WeatherStationVariable.HUMIDITY,
      HUMIDITY_SCALE,
    ),
    createStationLayer(
      'weather-stations/pressure',
      LAYER_NAMES.weatherStations.pressure.name,
      LAYER_NAMES.weatherStations.pressure.description,
      WeatherStationVariable.PRESSURE,
      PRESSURE_SCALE,
    ),
    createStationLayer(
      'weather-stations/visibility',
      LAYER_NAMES.weatherStations.visibility.name,
      LAYER_NAMES.weatherStations.visibility.description,
      WeatherStationVariable.VISIBILITY,
      VISIBILITY_SCALE,
    ),
    createStationLayer(
      'weather-stations/wind-speed',
      LAYER_NAMES.weatherStations.windSpeed.name,
      LAYER_NAMES.weatherStations.windSpeed.description,
      WeatherStationVariable.WIND_SPEED,
      WIND_SPEED_SCALE,
    ),
  ],
};
