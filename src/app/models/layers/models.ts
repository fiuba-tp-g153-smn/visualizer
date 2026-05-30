import type * as L from 'leaflet';
import type { Feature } from 'geojson';
import { ActiveLayerGroupId } from './groups.models';

/**
 * Tipos de capas basados en Leaflet
 * Determina cómo se renderiza la capa en el mapa
 */
export enum LayerType {
  TILE = 'tile', // L.TileLayer - Tiles precalculados (satélites, mapas base)
  WMS = 'wms', // L.TileLayer.WMS - Web Map Service
  VECTOR = 'vector', // L.GeoJSON - Vector overlays (isobaras MSLP, etc.) renderizados como overlay sobre raster
}

/**
 * La categoría no determina como se renderiza la capa, sino su comportamiento específico
 * (ej: capas de satélite tienen configuración temporal, capas de radar tienen elevaciones, etc.)
 * Esto permite tener diferentes tipos de capas dentro de la misma categoría si es necesario
 * y mantener la lógica de negocio separada de la lógica de renderizado.
 */
export enum LayerCategory {
  GOES_19 = 'goes_19', // GOES 19
  RADAR = 'radar', // Radar meteorológico
  IGN_WMS = 'ign_wms', // IGN WMS layers
  ECMWF_TP = 'ecmwf_tp', // ECMWF Total Precipitation
  WRF = 'wrf', // WRF-ARG4K (SMN) — multi-product forecast model
}

/**
 * Representa los límites geográficos de una capa en el formato de Leaflet.
 * Definido como [[latitud_sur, longitud_oeste], [latitud_norte, longitud_este]]
 * Compatible directamente con L.LatLngBoundsExpression de Leaflet.
 */
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

export interface ContinuousScale {
  type: ScaleType.CONTINUOUS;
  unit: string;
  stops: readonly ScaleColorStop[];
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
}

/**
 * Escala basada en PaletteConfig (formato tiles-processor)
 * Usado principalmente para capas de radar donde los colores están mapeados
 * a rangos específicos definidos por bounds
 */
export interface PaletteConfigScale {
  type: ScaleType.PALETTE_CONFIG;
  unit: string;
  hexColors: readonly string[]; // Array de colores hex
  bounds: readonly number[]; // Límites de valores para cada color
  useBoundaryNorm?: boolean; // Si true, usa normalizacion de límites
}

export type LayerScale = ContinuousScale | DiscreteScale | PaletteConfigScale;

interface BaseLayer {
  id: string;
  name: string;
  description?: string;
  category: LayerCategory;
  zIndexGroup: ActiveLayerGroupId;
  boundingBox?: BoundingBox;
  tms?: boolean;
}

/**
 * Unión discriminada de todos los tipos de capas
 * TypeScript puede inferir el tipo correcto basándose en la propiedad 'type'
 */
export type Layer =
  | ABIGoesTileLayer
  | GLMGoesTileLayer
  | RadarTileLayer
  | WmsLayer
  | EcmwfTpTileLayer
  | WrfTileLayer;

export interface TileLayer extends BaseLayer {
  type: LayerType.TILE;
  minNativeZoom: number; // Zoom mínimo nativo de la capa (nivel más alejado con datos disponibles)
  maxNativeZoom: number; // Zoom máximo nativo de la capa (nivel más cercano con datos disponibles)
  scale?: LayerScale;
  // Forecast layers (e.g. ECMWF) animate from the first N tilesets (closest to "now");
  // historical layers animate from the last N (most recent observations).
  isForecast: boolean;
}

export interface GoesTileLayer extends TileLayer {
  category: LayerCategory.GOES_19;
  availablePeriods?: readonly number[]; // Períodos disponibles para selección (ej: [1, 6, 12, 24])
}

export interface ABIGoesTileLayer extends GoesTileLayer {
  channel: string; // Canal específico del satélite (ej: 'ch-2', 'ch-9', etc.)
}

export interface GLMGoesTileLayer extends GoesTileLayer {
  variable: string; // Variable específica del GLM (ej: 'fed' para Flash Extent Density)
}

export interface RadarTileLayer extends TileLayer {
  category: LayerCategory.RADAR;
  availablePeriods: readonly number[]; // Períodos disponibles para selección (ej: [1, 6, 12, 24])
  availableElevations: readonly RadarElevation[]; // Elevaciones disponibles (ej: ['elev0', 'elev1', 'elev2'])
}

export interface RadarElevation {
  id: string;
  name: string;
  activeByDefault: boolean; // Indica si esta elevación debe seleccionarse por defecto al activar la capa
  zIndexPreference: number; // Z-index preference for stacking order (higher values render on top)
}

export interface EcmwfTpTileLayer extends TileLayer {
  category: LayerCategory.ECMWF_TP;
  variable: string; // Variable del modelo (siempre 'total-precipitation')
  availablePeriods?: readonly number[]; // Períodos disponibles para selección (cantidad de últimos timestamps a mostrar)
  /**
   * Render secundario asociado a esta capa (e.g. isobaras MSLP sobre el raster TP).
   * El secondary se activa, anima y oculta junto con el primary; no es seleccionable
   * por separado en la UI.
   */
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
  secondaryRenders?: readonly (SecondaryVectorRender | BarbTileRender)[];
}

/**
 * Estilo de una línea vectorial (isobaras, contornos, etc.). Se mapea casi
 * 1:1 a `L.PathOptions` de Leaflet.
 */
export interface VectorLineStyle {
  /** Stroke color en hex. */
  color: string;
  /** Ancho del stroke en píxeles. */
  weight: number;
  /** Patrón de dash (e.g. "4 2"). Opcional. */
  dashArray?: string;
  /** Opacidad del stroke 0..1. Opcional (por defecto 1). */
  opacity?: number;
}

/**
 * Opciones para `leaflet-textpath` (etiquetas a lo largo de la línea).
 */
export interface VectorTextpathOptions {
  center?: boolean;
  below?: boolean;
  offset?: number;
  orientation?: 'auto' | 'flip' | number;
  attributes?: Record<string, string>;
}

/**
 * Configuración de un overlay vectorial atado a una capa primaria (e.g. la
 * capa de raster). El overlay se renderiza encima del primary; ambos comparten
 * lifecycle (visibilidad, opacidad, timeline de animación).
 */
export interface SecondaryVectorRender {
  /** ID estable del overlay; usado para cache y para nombrar el pane Leaflet. */
  id: string;
  /** Construye la URL del GeoJSON para un par (forecast_ts, timestamp_ts). */
  buildUrl: (forecastTs: string, timestampTs: string) => string;
  /** Construye la URL de point query del overlay (opcional). */
  buildPointQueryUrl?: (
    forecastTs: string,
    timestampTs: string,
    lat: number,
    lon: number,
  ) => string;
  /** Nombre de la propiedad que contiene el valor numérico (e.g. 'pressure_hpa'). */
  valueProperty: string;
  /** Resuelve el estilo de cada feature según su valor numérico. */
  styleFor: (value: number) => VectorLineStyle;
  /** Resuelve el texto de la etiqueta para una feature; null/undefined → sin etiqueta. */
  labelFor: (value: number) => string | null;
  /** Opciones aplicadas a la etiqueta (centrado, font, etc.). */
  textpathOptions?: VectorTextpathOptions;
  /** Cantidad de frames adyacentes a precargar durante la animación. */
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
