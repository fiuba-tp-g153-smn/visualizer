import type * as L from 'leaflet';
import type { Feature } from 'geojson';
import { ActiveLayerGroupId } from './groups.models';
import type { ScaleRangeInfo } from './point-query.models';

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
  WRF = 'wrf',
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

export enum ScaleLabelScale {
  LINEAR = 'linear',
  LOG = 'log',
}

export interface ScaleSpecialPoint {
  value: number;
  color: string;
  label?: string;
}

export interface LayerScale {
  type: ScaleType;
  unit: string;
  entries: readonly ScaleColorStop[];
  labelCount?: number;
  subTickCount?: number;
  labelValues?: readonly number[];
  labelScale?: ScaleLabelScale;
  clipRange?: readonly [number, number];
  specialPoints?: readonly ScaleSpecialPoint[];
  scaleRoutingKey?: string;
  scaleDisplayName?: string;
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
  | ForecastModelTileLayer;

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
 * Modelos numéricos organizados en corridas + pasos de pronóstico.
 * Hoy: WRF-ARG4K (`wrf`) y GFS 0.25° (`gfs`). Lo único que los diferencia es
 * cómo se arman las URLs y cómo se parsea la etiqueta de corrida; de eso se
 * ocupa el adaptador en `config/layers/forecast-model.ts`.
 */
export type ForecastModelId = 'wrf' | 'gfs';

/**
 * Capa de modelo numérico por corrida/paso. Cada producto (Colmax, Rafagas,
 * 500 hPa, ...) es una capa independiente identificada por `productId`. Las
 * corridas y los pasos de pronóstico (fxxx) se descubren dinámicamente vía
 * data-service.
 */
export interface ForecastModelTileLayer extends TileLayer {
  category: LayerCategory.WRF;
  /**
   * Modelo al que pertenece la capa. Ausente equivale a `'wrf'`, que era el
   * único modelo con esta forma antes de incorporar GFS.
   */
  modelId?: ForecastModelId;
  /** Identificador del producto (ej. 'Colmax', 'Rafagas', '500hpa'). */
  productId: string;
  /**
   * `false` para productos que son solo contornos y no tienen pirámide raster
   * (ej. la presión a nivel del mar de GFS). Ausente equivale a `true`.
   * El dato puntual sigue disponible: lo que falta son los tiles, no el COG.
   */
  hasRaster?: boolean;
  /**
   * Rango para ubicar el dato puntual en la barra de escala cuando la capa no
   * tiene `scale` propia (caso `hasRaster: false`, sin leyenda de colores).
   */
  pointQueryScaleRange?: ScaleRangeInfo;
  /** Períodos disponibles (cantidad de últimos pasos a mostrar). */
  availablePeriods?: readonly number[];
  /**
   * Etiqueta del valor primario en el dato puntual. Si se omite, usa el `name`
   * de la capa. Permite un nombre más descriptivo en el point query sin alargar
   * el label del menú (ej. menú "Precipitación 1h" → query "Precipitación
   * acumulada 1 hora").
   */
  pointQueryLabel?: string;
  /**
   * Renders vectoriales secundarios (barbas, contornos) atados a esta capa.
   * Cada uno se anima con el primary tile, comparte timeline y forecast run.
   * A diferencia de ECMWF (un único secondary), WRF puede traer N overlays
   * por producto (ej. JetCapasBajas: barbas + shear_850_700).
   */
  secondaryRenders?: readonly (SecondaryVectorRender | BarbTileRender)[];
}

/**
 * Nombre histórico de `ForecastModelTileLayer`. Se mantiene porque toda la
 * maquinaria de controles, playback y point query ya lo usa; las capas GFS
 * pasan por exactamente el mismo camino.
 */
export type WrfTileLayer = ForecastModelTileLayer;

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

/**
 * Metadata para consultar una variable secundaria en el dato puntual.
 * `variable` es la clave del COG secundario en el backend (ej. 'wind', 'slp').
 * El front aporta nombre, unidad y escala; el backend devuelve el valor.
 */
export interface WrfSecondaryPointQuery {
  variable: string;
  name: string;
  unit: string;
  scaleRange: ScaleRangeInfo;
}

export interface SecondaryVectorRender {
  id: string;
  buildUrl: (forecastTs: string, timestampTs: string) => string;
  backendLayerName?: string;
  /** Habilita una fila de dato puntual para esta variable secundaria. */
  pointQuery?: WrfSecondaryPointQuery;
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
   * Longitud mínima (en grados) que debe tener una polyline para llevar
   * etiqueta. Si se omite, se usa el default global del service.
   */
  minLabelLengthDeg?: number;
  /**
   * Constructor opcional para Point features (barbas, símbolos puntuales).
   * Cuando está presente, `VectorOverlayService.buildLayer` lo usa como
   * `pointToLayer` de Leaflet. Para overlays Line/Polyline (isobaras,
   * contornos) se omite y la renderización cae al style + setText path.
   */
  pointToLayer?: (feature: Feature, latlng: L.LatLng) => L.Layer;
}

/**
 * Render secundario que se sirve como tiles raster z/x/y (en lugar de GeoJSON
 * vectorial). Hoy se usa para barbas WRF rasterizadas en el backend.
 */
export interface BarbTileRender {
  readonly kind: 'barb-tile';
  /** ID estable del overlay; usado para cache y nombrado de pane. */
  readonly id: string;
  /** Habilita una fila de dato puntual (magnitud del viento) para las barbas. */
  readonly pointQuery?: WrfSecondaryPointQuery;
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
  DEW_POINT = 'dew_point',
}

/**
 * Capa de tipo WMS (servicios Web Map Service)
 * Usa L.TileLayer.WMS de Leaflet
 */
export interface WmsLayer extends BaseLayer {
  type: LayerType.WMS;
  wmsLayerName: string;
  wmsWorkspace?: string;
}
