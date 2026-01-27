/**
 * Modelos para el sistema de capas
 */

export enum LayerType {
  RASTER = 'raster', // Imágenes satelitales, tiles, overlays
}

export enum LayerCategory {
  SATELLITE_ABI = 'satellite_abi', // GOES ABI (canales individuales)
  SATELLITE_GLM = 'satellite_glm', // GOES GLM (canales individuales)
}

/**
 * Configuración de reproducción temporal de una capa
 */
export interface LayerPlaybackConfig {
  isPlaying: boolean; // Si está reproduciéndose automáticamente
  speed: number; // Velocidad en segundos por frame (0.4-10)
  maxTimeIndex?: number; // Índice máximo guardado para reiniciar
  minTimeIndex?: number; // Índice mínimo basado en lastImagesCount
  lastImagesCount?: number; // Número de últimas imágenes a mostrar (6, 12, 24, etc.)
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
  timeIndex?: number; // Índice del tileset temporal seleccionado (0-based)
  playback?: LayerPlaybackConfig; // Configuración de reproducción
  availablePeriods?: readonly number[]; // Períodos disponibles para selección (ej: [1, 6, 12, 24])
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
  icon: string; // Material icon name
  subgroups: LayerSubgroup[];
  expanded: boolean;
}
