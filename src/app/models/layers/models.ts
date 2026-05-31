import type * as L from 'leaflet';
import type { Feature } from 'geojson';
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
  WRF = 'wrf', // WRF-ARG4K (SMN) — multi-product forecast model
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
  | WeatherStationLayer
  | WrfTileLayer;

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

/**
 * Capa WRF-ARG4K. Cada producto del modelo (Colmax, Rafagas, Precipitacion1h, ...)
 * es una capa independiente identificada por `productId`. Las corridas (init runs)
 * y pasos de pronóstico (fxxx) se descubren dinámicamente vía data-service.
 */
export interface WrfTileLayer extends TileLayer {
  category: LayerCategory.WRF;
  /** Identificador del producto WRF (ej. 'Colmax', 'Rafagas', 'JetCapasBajas'). */
  productId: string;
  /** Períodos disponibles (cantidad de últimos pasos a mostrar). */
  availablePeriods?: readonly number[];
  /**
   * Renders vectoriales secundarios (barbas, contornos) atados a esta capa.
   * Cada uno se anima con el primary tile, comparte timeline y forecast run.
   * A diferencia de ECMWF (un único secondary), WRF puede traer N overlays
   * por producto (ej. JetCapasBajas: barbas + shear_850_700).
   */
  secondaryRenders?: readonly SecondaryVectorRender[];
}

/**
 * Estilo de una línea vectorial (isobaras, contornos, etc.). Se mapea casi
 * 1:1 a `L.PathOptions` de Leaflet.
 */
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
  /**
   * Constructor opcional para Point features (barbas, símbolos puntuales).
   * Cuando está presente, `VectorOverlayService.buildLayer` lo usa como
   * `pointToLayer` de Leaflet. Para overlays Line/Polyline (isobaras,
   * contornos) se omite y la renderización cae al style + setText path.
   */
  pointToLayer?: (feature: Feature, latlng: L.LatLng) => L.Layer;
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
