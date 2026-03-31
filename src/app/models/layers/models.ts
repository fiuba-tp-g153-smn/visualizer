import { ActiveLayerGroupId } from './groups.models';

/**
 * Tipos de capas basados en Leaflet
 * Determina cómo se renderiza la capa en el mapa
 */
export enum LayerType {
  TILE = 'tile', // L.TileLayer - Tiles precalculados (satélites, mapas base)
  WMS = 'wms', // L.TileLayer.WMS - Web Map Service
  // Futuros: VECTOR = 'vector', GEOJSON = 'geojson', etc.
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
export type Layer = ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer | WmsLayer;

export interface TileLayer extends BaseLayer {
  type: LayerType.TILE;
  minNativeZoom: number; // Zoom mínimo nativo de la capa (nivel más alejado con datos disponibles)
  maxNativeZoom: number; // Zoom máximo nativo de la capa (nivel más cercano con datos disponibles)
  scale?: LayerScale;
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

/**
 * Capa de tipo WMS (servicios Web Map Service)
 * Usa L.TileLayer.WMS de Leaflet
 */
export interface WmsLayer extends BaseLayer {
  type: LayerType.WMS;
  wmsLayerName: string;
  wmsWorkspace?: string;
}
