import { ActiveLayerGroupId } from './groups.models';

export enum LayerType {
  TILE = 'tile',
  WMS = 'wms',
  VECTOR = 'vector',
}

// category = comportamiento (temporal, elevaciones, etc.); type = estrategia de renderizado Leaflet
export enum LayerCategory {
  GOES_19 = 'goes_19',
  RADAR = 'radar',
  IGN_WMS = 'ign_wms',
  ECMWF_TP = 'ecmwf_tp',
  WEATHER_STATIONS = 'weather_stations',
}

// [[lat_sur, lon_oeste], [lat_norte, lon_este]] — compatible con L.LatLngBoundsExpression
export type BoundingBox = readonly [readonly [number, number], readonly [number, number]];

export interface ScaleColorStop {
  value: number;
  color: string;
  label?: string;
  hardStop?: boolean;
}

export enum ScaleType {
  CONTINUOUS = 'continuous',
  DISCRETE = 'discrete',
}

export const ScaleLabelScale = {
  LINEAR: 'linear',
  LOG: 'log',
} as const;

export type ScaleLabelScale = (typeof ScaleLabelScale)[keyof typeof ScaleLabelScale];

export interface LayerScale {
  type: ScaleType;
  unit: string;
  entries: readonly ScaleColorStop[];
  labelCount?: number;
  subTickCount?: number;
  labelValues?: readonly number[];
  labelScale?: ScaleLabelScale;
  labelDomain?: readonly [number, number];
  // Optional clipping window applied consistently to labels and colors.
  clipRange?: readonly [number, number];
}

interface BaseLayer {
  id: string;
  name: string;
  description?: string;
  category: LayerCategory;
  zIndexGroup: ActiveLayerGroupId;
  boundingBox?: BoundingBox;
  scale?: LayerScale;
  tms?: boolean;
}

export type Layer =
  | ABIGoesTileLayer
  | GLMGoesTileLayer
  | RadarTileLayer
  | WmsLayer
  | EcmwfTpTileLayer
  | WeatherStationLayer;

export interface TileLayer extends BaseLayer {
  type: LayerType.TILE;
  minNativeZoom: number;
  maxNativeZoom: number;
  scale?: LayerScale;
  // Forecast layers animate from the first N tilesets; historical from the last N.
  isForecast: boolean;
}

export interface GoesTileLayer extends TileLayer {
  category: LayerCategory.GOES_19;
  availablePeriods?: readonly number[];
}

export interface ABIGoesTileLayer extends GoesTileLayer {
  channel: string;
}

export interface GLMGoesTileLayer extends GoesTileLayer {
  variable: string;
}

export interface RadarTileLayer extends TileLayer {
  category: LayerCategory.RADAR;
  availablePeriods: readonly number[];
  availableElevations: readonly RadarElevation[];
}

export interface RadarElevation {
  id: string;
  name: string;
  activeByDefault: boolean;
  zIndexPreference: number;
}

export interface EcmwfTpTileLayer extends TileLayer {
  category: LayerCategory.ECMWF_TP;
  variable: string; // siempre 'total-precipitation'
  availablePeriods?: readonly number[];
  // Se activa, anima y oculta junto con el primary; no seleccionable por separado.
  secondaryRender?: SecondaryVectorRender;
}

// Mapea casi 1:1 a L.PathOptions de Leaflet
export interface VectorLineStyle {
  color: string;
  weight: number;
  dashArray?: string;
  opacity?: number;
}

// Opciones para leaflet-textpath (etiquetas a lo largo de una línea)
export interface VectorTextpathOptions {
  center?: boolean;
  below?: boolean;
  offset?: number;
  orientation?: 'auto' | 'flip' | number;
  attributes?: Record<string, string>;
}

export interface SecondaryVectorRender {
  id: string;
  buildUrl: (forecastTs: string, timestampTs: string) => string;
  buildPointQueryUrl?: (
    forecastTs: string,
    timestampTs: string,
    lat: number,
    lon: number,
  ) => string;
  valueProperty: string;
  styleFor: (value: number) => VectorLineStyle;
  labelFor: (value: number) => string | null;
  textpathOptions?: VectorTextpathOptions;
  prefetchWindow?: number;
}

export interface WeatherStationLayer extends BaseLayer {
  type: LayerType.VECTOR;
  category: LayerCategory.WEATHER_STATIONS;
  variable: WeatherStationVariable;
  scale: NonNullable<LayerScale>;
}

export enum WeatherStationVariable {
  TEMPERATURE = 'temperature',
  FEELS_LIKE = 'feels_like',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  VISIBILITY = 'visibility',
  WIND_SPEED = 'wind_speed',
}

export interface WmsLayer extends BaseLayer {
  type: LayerType.WMS;
  wmsLayerName: string;
  wmsWorkspace?: string;
}
