import { LayerCategory, LayerType } from './models';

export interface BaseLayerConfig {
  layerId: string;
}

export type LayerConfig = GoesTileLayerConfig | RadarTileLayerConfig | WmsLayerConfig;

export interface TilesetEntry {
  id: string;
  time: Date;
}

export interface TileLayerConfig extends BaseLayerConfig {
  type: LayerType.TILE;
  availableTilesets: TilesetEntry[];
}

export interface GoesTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.GOES_19;
}

export interface RadarTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.RADAR;
}

export interface WmsLayerConfig extends BaseLayerConfig {
  type: LayerType.WMS;
}
