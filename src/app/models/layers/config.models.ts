import { LayerCategory, LayerType } from './models';

export interface BaseLayerConfig {
  layerId: string;
}

export type LayerConfig = GoesTileLayerConfig | RadarTileLayerConfig | WmsLayerConfig | EcmwfTileLayerConfig;

export interface TileLayerConfig extends BaseLayerConfig {
  type: LayerType.TILE;
}

export interface GoesTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.GOES_19;
  availableTilesets: string[];
}

export interface RadarTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.RADAR;
  availableTilesets: string[];
}

export interface WmsLayerConfig extends BaseLayerConfig {
  type: LayerType.WMS;
}

export interface EcmwfTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.ECMWF;
  availableTilesets: string[]; // Unión de períodos de las corridas seleccionadas, ordenados asc
  availableForecasts: string[]; // Todos los forecast_ts disponibles, ordenados desc
  periodsByForecast: Readonly<Record<string, string[]>>; // Todos los períodos por corrida
  forecastsByPeriod: Readonly<Record<string, string[]>>; // Lookup inverso: período → corridas que lo tienen
}
