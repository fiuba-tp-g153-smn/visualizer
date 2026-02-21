/**
 * Modelos para la configuración dinámica de canales desde el backend
 */

export interface ChannelZoomLevels {
  min: number;
  max: number;
}

export interface ChannelBoundingBox {
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export interface ChannelInfo {
  name: string;
  description: string;
  zoom_levels: ChannelZoomLevels;
  bounding_box: ChannelBoundingBox;
  tile_format: string;
}

export interface Tileset {
  id: string;
  url_pattern: string;
}

export interface ChannelConfig {
  product: string;
  instrument: string;
  channel: string;
  channel_info: ChannelInfo;
  tilesets: Tileset[];
  tile_url_pattern: string;
}

/**
 * Configuración de radar con elevaciones
 */
export interface RadarConfig {
  radar_id: string;
  variable_id: string;
  elevation_id: string;
  channel_info: ChannelInfo;
  tilesets: Tileset[];
  tile_url_pattern: string;
}

/**
 * Cache de configuraciones de canales cargadas
 */
export interface ChannelConfigCache {
  [layerId: string]: ChannelConfig | RadarConfig;
}
