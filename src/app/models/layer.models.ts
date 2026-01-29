/**
 * Modelos para el sistema de capas
 */

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
 * Categorías de capas para comportamientos específicos
 * NO determina el renderizado (eso lo hace LayerType)
 * Agrupa capas con características comunes de comportamiento
 */
export enum LayerCategory {
  SATELLITE_ABI = 'satellite_abi', // GOES ABI (canales individuales)
  IGN_WMS = 'ign_wms', // IGN WMS layers - permanecen en z-index superior
}

/**
 * Grupos de capas activas para organizar por niveles
 * Las capas solo se pueden reordenar dentro de su propio grupo
 */
export enum ActiveLayerGroup {
  BASE = 'base', // Capas base (datos: satélite, modelos, etc.)
  OVERLAY = 'overlay', // Capas superiores (IGN, referencias, etc.)
}

/**
 * Definición completa de un grupo de capas activas
 */
export interface ActiveLayerGroupDefinition {
  id: ActiveLayerGroup;
  name: string;
  subtitle: string;
  description?: string;
  icon: string;
  zIndexRange: { min: number; max: number };
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
 * Configuración para capas con control temporal (satélites, modelos numéricos)
 * Se usa como composición: solo las capas que necesitan control de tiempo tienen esta config
 */
export interface TimeBasedLayerConfig {
  timeIndex?: number; // Índice del tileset temporal seleccionado (0-based)
  playback?: LayerPlaybackConfig; // Configuración de reproducción
  availablePeriods?: readonly number[]; // Períodos disponibles para selección (ej: [1, 6, 12, 24])
}

/**
 * Metadata para grupos de capas activas con funciones de control
 */
export interface ZIndexGroupMetadata {
  id: ActiveLayerGroup;
  name: string;
  subtitle: string;
  description?: string;
  icon: string;
  layers: Layer[];
  expanded: () => boolean;
  setExpanded: (value: boolean) => void;
  onDrop: (event: any) => void;
  clearGroup: (event: Event) => void;
}

/**
 * Estado de capa para persistencia
 */
export interface LayerState {
  id: string;
  visible: boolean;
  opacity: number;
  zIndex?: number;
  // Configuración temporal (solo para capas con control de tiempo)
  timeControl?: {
    timeIndex?: number;
    playback?: LayerPlaybackConfig;
  };
}

/**
 * Capa base - propiedades comunes a todas las capas
 */
export interface Layer {
  id: string;
  name: string;
  description?: string;
  type: LayerType; // Determina cómo se renderiza (tile, wms, etc.)
  category: LayerCategory; // Determina comportamiento específico de la capa
  visible: boolean;
  opacity: number; // 0-100
  zIndex?: number; // RELATIVO al grupo (0, 1, 2...), no absoluto
  zIndexGroup: ActiveLayerGroup; // Grupo de capas activas (base o overlay)

  // Configuración opcional para capas con control temporal
  // Solo presente en capas que lo necesitan (satélites, modelos)
  timeControl?: TimeBasedLayerConfig;
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
