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

/**
 * Respuesta de `/products/availability`: qué productos tienen datos ahora.
 *
 * `available` son rutas de producto, las MISMAS que usaría un sondeo
 * individual (`radar-sinarame/RMA2/dbzh/elev0`, `goes19/abi/c13`,
 * `wrf-arg4k/granizo`), así que el cliente hace un lookup en vez de una
 * petición.
 *
 * La lista es COMPLETA: el backend la arma recorriendo el mismo camino de
 * lectura que recorrería el endpoint por producto (Redis y, si está frío, S3),
 * así que un producto ausente no tiene datos y no hace falta sondearlo.
 *
 * `domains` es diagnóstico: qué dominios aportaron al menos un producto.
 */
export interface ProductAvailabilitySnapshot {
  readonly available: readonly string[];
  readonly domains: readonly string[];
}
