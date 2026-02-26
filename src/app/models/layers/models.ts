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

interface BaseLayer {
  id: string;
  name: string;
  description?: string;
  category: LayerCategory;
  zIndexGroup: ActiveLayerGroupId;
  boundingBox?: BoundingBox;
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Unión discriminada de todos los tipos de capas
 * TypeScript puede inferir el tipo correcto basándose en la propiedad 'type'
 */
export type Layer = ABIGoesTileLayer | GLMGoesTileLayer | RadarTileLayer | WmsLayer;

export interface TileLayer extends BaseLayer {
  type: LayerType.TILE;
}

export interface GoesTileLayer extends TileLayer {
  category: LayerCategory.GOES_19;
  availablePeriods?: readonly number[]; // Períodos disponibles para selección (ej: [1, 6, 12, 24])
}

export interface ABIGoesTileLayer extends GoesTileLayer {
  channel: string; // Canal específico del satélite (ej: 'ch-02', 'ch-09', etc.)
}

export interface GLMGoesTileLayer extends GoesTileLayer {
  variable: string; // Variable específica del GLM (ej: 'fed' para Flash Extent Density)
}

export interface RadarTileLayer extends TileLayer {
  category: LayerCategory.RADAR;
  availablePeriods: readonly number[]; // Períodos disponibles para selección (ej: [1, 6, 12, 24])
  availableElevations: readonly string[]; // Elevaciones disponibles (ej: ['elev0', 'elev1', 'elev2'])
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
