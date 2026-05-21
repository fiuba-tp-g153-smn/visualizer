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
  SMN_STATIONS = 'smn_stations',
}

// [[lat_sur, lon_oeste], [lat_norte, lon_este]] — compatible con L.LatLngBoundsExpression
export type BoundingBox = readonly [readonly [number, number], readonly [number, number]];

export interface ScaleColorStop {
  value: number;
  color: string;
  label?: string;
}

export enum ScaleType {
  CONTINUOUS = 'continuous',
  DISCRETE = 'discrete',
  PALETTE_CONFIG = 'palette_config', // Para paletas con bounds y boundary_norm (radar)
}

export const ScaleLabelScale = {
  LINEAR: 'linear',
  LOG: 'log',
} as const;

export type ScaleLabelScale = (typeof ScaleLabelScale)[keyof typeof ScaleLabelScale];

export interface ContinuousScale {
  type: ScaleType.CONTINUOUS;
  unit: string;
  stops: readonly ScaleColorStop[];
  labelCount?: number;
  subTickCount?: number;
  labelValues?: readonly number[];
  labelScale?: ScaleLabelScale;
  labelDomain?: readonly [number, number];
}

export interface DiscreteScaleStep {
  value: number;
  color: string;
  label?: string;
}

export interface DiscreteScale {
  type: ScaleType.DISCRETE;
  unit: string;
  steps: readonly DiscreteScaleStep[];
  labelCount?: number;
  subTickCount?: number;
  labelRange?: readonly [number, number];
  labelValues?: readonly number[];
  labelScale?: ScaleLabelScale;
  labelDomain?: readonly [number, number];
}

export interface PaletteConfigScale {
  type: ScaleType.PALETTE_CONFIG;
  unit: string;
  hexColors: readonly string[];
  bounds: readonly number[];
  useBoundaryNorm?: boolean;
  labelCount?: number;
  subTickCount?: number;
}

export type LayerScale = ContinuousScale | DiscreteScale | PaletteConfigScale;

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
  | SmnStationLayer;

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
  buildPointQueryUrl?: (forecastTs: string, timestampTs: string, lat: number, lon: number) => string;
  valueProperty: string;
  styleFor: (value: number) => VectorLineStyle;
  labelFor: (value: number) => string | null;
  textpathOptions?: VectorTextpathOptions;
  prefetchWindow?: number;
}

export interface SmnStationLayer extends BaseLayer {
  type: LayerType.VECTOR;
  category: LayerCategory.SMN_STATIONS;
  variable: 'temperature' | 'feels_like' | 'humidity' | 'pressure' | 'visibility' | 'wind_speed';
  scale: NonNullable<LayerScale>;
}

export interface WmsLayer extends BaseLayer {
  type: LayerType.WMS;
  wmsLayerName: string;
  wmsWorkspace?: string;
}
