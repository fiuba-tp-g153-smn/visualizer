import { LayerCategory, LayerType } from './models';

export interface BaseLayerControls {
  id: string;
  visible: boolean;
  opacity: number;
  zIndex?: number; // When layer is active, it has a zIndex for ordering; when inactive, it may be undefined
}

export type LayerControls = GoesLayerControls | RadarLayerControls | WmsLayerControls;

export interface TileLayerControls extends BaseLayerControls {
  type: LayerType.TILE;
  playback: PlaybackControls;
}

export interface GoesLayerControls extends TileLayerControls {
  category: LayerCategory.GOES_19;
  availablePeriods?: readonly number[];
}

export interface RadarLayerControls extends TileLayerControls {
  category: LayerCategory.RADAR;
  elevation: ElevationControls;
}

export interface PlaybackControls {
  isPlaying: boolean;
  timeIndex?: number; // Puede ser null si no se ha seleccionado ningún período o si la capa no tiene períodos disponibles
  speed: number;
  lastImagesCount: number; // Número de últimas imágenes a mostrar (1, 6, 12, 24, etc.)
}

export interface ElevationControls {
  elevationIndex?: number; // Índice de elevación seleccionado, puede ser null si no se ha seleccionado ninguno o si la capa no tiene elevaciones disponibles
}

export interface WmsLayerControls extends BaseLayerControls {
  type: LayerType.WMS;
}
