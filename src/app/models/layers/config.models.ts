import { LayerCategory, LayerType } from './models';

export interface BaseLayerConfig {
  layerId: string;
}

export type LayerConfig =
  | GoesTileLayerConfig
  | RadarTileLayerConfig
  | WmsLayerConfig
  | EcmwfTpTileLayerConfig
  | WrfTileLayerConfig;

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

export interface EcmwfTpTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.ECMWF_TP;
  availableForecasts: string[];
  periodsByForecast: Readonly<Record<string, string[]>>;
  forecastsByPeriod: Readonly<Record<string, string[]>>;
}

/**
 * Config WRF: análoga a ECMWF_TP — `availableForecasts` mapea a init_tags,
 * `periodsByForecast` mapea a `{init_tag → fxxx[]}`. Reusa la misma forma
 * para que el time slicer y los forecast filters funcionen sin distinguir.
 * Layers list: GeoJSON layers (barbas/contornos) por (init_tag, fxxx).
 */
export interface WrfTileLayerConfig extends TileLayerConfig {
  category: LayerCategory.WRF;
  availableForecasts: string[];
  periodsByForecast: Readonly<Record<string, string[]>>;
  forecastsByPeriod: Readonly<Record<string, string[]>>;
  /** layers["init_tag/fxxx"] = ['barbs', 'slp', ...] (overlay GeoJSON layer names). */
  layersByStep: Readonly<Record<string, readonly string[]>>;
}
