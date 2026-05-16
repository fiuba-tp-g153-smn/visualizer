import { ActiveLayerGroupId, LayerCategory, LayerScale, LayerType } from '../../../models';
import { LayerSelectionMode, LayerSubgroup } from '../../../models/layers/groups.models';
import {
  FEELS_LIKE_SCALE,
  HUMIDITY_SCALE,
  PRESSURE_SCALE,
  TEMPERATURE_SCALE,
  VISIBILITY_SCALE,
  WEATHER_SCALE,
  WIND_SPEED_SCALE,
} from './scales.config';

import { SmnStationLayer } from '../../../models/layers/models';

export const SMN_STATION_PANE = 'smn-station-pane';
// Fallback z-index; MapLayersService sets this dynamically per active-layer order.
export const SMN_STATION_PANE_Z_INDEX = '560';

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
