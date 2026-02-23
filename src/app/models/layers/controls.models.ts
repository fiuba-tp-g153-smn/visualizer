import { LayerCategory, LayerType } from './models';

export interface BaseLayerControls {
  id: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
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
  playback: PlaybackControls;
  elevation: ElevationControls;
}

export interface PlaybackControls {
  isPlaying: boolean;
  timeIndex: number;
  speed: number;
  maxTimeIndex?: number; // Índice máximo guardado para reiniciar
  minTimeIndex?: number; // Índice mínimo basado en lastImagesCount
  lastImagesCount?: number; // Número de últimas imágenes a mostrar (6, 12, 24, etc.)
}

export interface ElevationControls {
  elevationIndex: number;
}

export interface WmsLayerControls extends BaseLayerControls {
  type: LayerType.WMS;
}
