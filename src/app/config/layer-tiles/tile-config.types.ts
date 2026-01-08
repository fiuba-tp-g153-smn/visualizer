import * as L from 'leaflet';

/**
 * Configuración de tile layer para una capa específica
 */
export interface TileLayerConfig {
  urlTemplate: string;
  options: L.TileLayerOptions;
}

/**
 * Opciones comunes para tiles satelitales procesados con gdal2tiles
 */
export const SATELLITE_TILE_OPTIONS: L.TileLayerOptions = {
  minNativeZoom: 4,
  maxNativeZoom: 8,
  minZoom: 0,
  maxZoom: 18,
  tms: true, // gdal2tiles usa TMS
  bounds: [
    [-55.0, -74.0], // Sur-oeste Argentina
    [-21.0, -53.0], // Norte-este Argentina
  ],
  noWrap: true,
};
