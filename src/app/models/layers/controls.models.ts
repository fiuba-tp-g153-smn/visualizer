import { Layer, LayerCategory, LayerType } from './models';

export interface BaseLayerControls {
  id: string;
  visible: boolean;
  opacity: number;
  /**
   * Z-index for layer ordering (higher values appear on top)
   * Active layers have values > 0, inactive layers have 0
   */
  zIndex: number;
}

export type LayerControls = GoesLayerControls | RadarLayerControls | WmsLayerControls | EcmwfTpLayerControls;

/** A layer that is currently active (visible) on the map, paired with its controls. */
export interface ActiveLayerEntry {
  layer: Layer;
  controls: LayerControls;
}

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
  selectedElevationIds: string[]; // IDs de elevaciones seleccionadas (puede estar vacío si no se ha seleccionado ninguna)
  elevationOpacity: Record<string, number>; // Opacity per elevation (0-1), undefined uses the layer's global opacity
}

export interface WmsLayerControls extends BaseLayerControls {
  type: LayerType.WMS;
}

export interface EcmwfTpForecastControls {
  selectedForecastTimestamps: string[]; // IDs of selected forecast runs
  forecastOpacity: Record<string, number>; // Opacity per forecast run (0-1), undefined uses the layer's global opacity
}

export interface EcmwfTpLayerControls extends TileLayerControls {
  category: LayerCategory.ECMWF_TP;
  forecast: EcmwfTpForecastControls;
  availablePeriods?: readonly number[];
}
