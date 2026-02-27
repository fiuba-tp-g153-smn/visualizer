import { LayerCategory, LayerType } from './models';

export interface BaseLayerConfig {
  layerId: string;
}

export type LayerConfig = GoesTileLayerConfig | RadarTileLayerConfig | WmsLayerConfig;

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
