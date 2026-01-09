/**
 * Modelos para el sistema de capas
 */

export enum LayerType {
  RASTER = 'raster', // Imágenes satelitales, tiles, overlays
}

export enum LayerCategory {
  SATELLITE_ABI = 'satellite_abi', // GOES ABI (canales individuales)
}

/**
 * Capa individual
 */
export interface Layer {
  id: string;
  name: string;
  description?: string;
  type: LayerType;
  category: LayerCategory;
  visible: boolean;
  opacity: number; // 0-100
  zIndex?: number; // Solo para capas visibles, define orden de renderizado
}

/**
 * Subgrupo: contiene capas
 */
export interface LayerSubgroup {
  id: string;
  name: string;
  description?: string;
  layers: Layer[];
  expanded: boolean;
}

/**
 * Grupo principal: contiene subgrupos
 */
export interface LayerGroup {
  id: string;
  name: string;
  description?: string;
  subgroups: LayerSubgroup[];
  expanded: boolean;
}
