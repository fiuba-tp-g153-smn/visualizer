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

export type LayerControls =
  | GoesLayerControls
  | RadarLayerControls
  | WmsLayerControls
  | EcmwfTpLayerControls
  | VectorLayerControls
  | WrfLayerControls;

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
  imageCount: number; // Número de últimas imágenes a mostrar (1, 6, 12, 24, etc.)
}

export interface ElevationControls {
  selectedElevationIds: string[]; // IDs de elevaciones seleccionadas (puede estar vacío si no se ha seleccionado ninguna)
  elevationOpacity: Record<string, number>; // Opacity per elevation (0-1), undefined uses the layer's global opacity
}

export interface VectorLayerControls extends BaseLayerControls {
  type: LayerType.VECTOR;
}

export interface WmsLayerControls extends BaseLayerControls {
  type: LayerType.WMS;
}

export interface EcmwfTpForecastControls {
  // Radar-like level 1: explicit selected run IDs + per-run opacity overrides.
  selectedForecastTimestamps: string[]; // IDs of selected forecast runs
  forecastOpacity: Record<string, number>; // Opacity per forecast run (0-1), undefined uses the layer's global opacity
  // Level 2 nested by run: selected secondary renders + per-render opacity overrides.
  renderControls: ForecastRenderControlsByForecast;
}

/** Stable ID reserved for the primary raster tile render of a forecast run. */
export const PRIMARY_RENDER_ID = 'primary' as const;

export interface ForecastRenderControls {
  // Mirrors radar elevation selection model for secondary renders.
  selectedRenderIds: string[];
  // Most specific opacity override (layer -> forecast -> secondary render).
  renderOpacity: Record<string, number>;
}

export type ForecastRenderControlsByForecast = Record<string, ForecastRenderControls>;

export interface EcmwfTpLayerControls extends TileLayerControls {
  category: LayerCategory.ECMWF_TP;
  forecast: EcmwfTpForecastControls;
  availablePeriods?: readonly number[];
}

/**
 * Controls WRF (corridas/init runs + opcional opacidad por corrida).
 * Forma idéntica a ECMWF_TP — el campo `forecast.selectedForecastTimestamps`
 * almacena init_tags ('20260430_060000').
 */
export interface WrfForecastControls {
  selectedForecastTimestamps: string[];
  forecastOpacity: Record<string, number>;
  renderControls: ForecastRenderControlsByForecast;
}

export interface WrfLayerControls extends TileLayerControls {
  category: LayerCategory.WRF;
  forecast: WrfForecastControls;
  availablePeriods?: readonly number[];
}
