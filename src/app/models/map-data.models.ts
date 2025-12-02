/**
 * Modelos de datos para capas del mapa
 * Representan datos reales que vienen del backend
 */

// =============================================================================
// TIPOS BASE
// =============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// =============================================================================
// PUNTOS (EMAs, Estaciones, etc.)
// =============================================================================

export interface MapPoint<T = unknown> {
  id: string;
  coordinates: Coordinates;
  data: T;
}

// Datos específicos de una EMA
export interface EmaPointData {
  nombre: string;
  provincia?: string;
  temperatura?: number;
  humedad?: number;
  presion?: number;
  viento_velocidad?: number;
  viento_direccion?: number;
  precipitacion?: number;
  fecha_actualizacion?: string;
}

// Datos de estación convencional (SYNOP/METAR)
export interface StationPointData {
  nombre: string;
  tipo: 'synop' | 'metar' | 'speci';
  icao?: string;
  oaci?: string;
  datos_raw?: string;
  temperatura?: number;
  visibilidad?: number;
  viento_velocidad?: number;
  viento_direccion?: number;
  presion?: number;
  tiempo_presente?: string;
  nubes?: string;
}

// =============================================================================
// VECTORES (Viento, corrientes, etc.)
// =============================================================================

export interface VectorData {
  id: string;
  origin: Coordinates;
  magnitude: number; // Intensidad/velocidad
  direction: number; // Dirección en grados (0-360)
  u?: number; // Componente U (este-oeste)
  v?: number; // Componente V (norte-sur)
}

export interface VectorField {
  id: string;
  name: string;
  vectors: VectorData[];
  metadata?: {
    unit?: string;
    fecha?: string;
    nivel?: string; // ej: "10m", "850hPa"
  };
}

// =============================================================================
// IMÁGENES RASTER (Satelitales, Radar, Modelos)
// =============================================================================

export interface RasterImageData {
  id: string;
  name: string;
  imageUrl: string; // URL de la imagen para superponer
  bounds: BoundingBox; // Límites geográficos de la imagen
  opacity?: number;
  metadata?: {
    fecha?: string;
    producto?: string;
    canal?: string;
    resolucion?: string;
  };
}

// Para animaciones (múltiples frames)
export interface RasterAnimationData {
  id: string;
  name: string;
  frames: RasterImageData[];
  currentFrameIndex: number;
  intervalMs: number;
}

// =============================================================================
// RESPUESTAS DEL BACKEND
// =============================================================================

export interface PointsResponse<T = unknown> {
  data: MapPoint<T>[];
  metadata?: {
    total: number;
    timestamp: string;
  };
}

export interface VectorFieldResponse {
  data: VectorField;
  metadata?: {
    timestamp: string;
  };
}

export interface RasterResponse {
  data: RasterImageData | RasterAnimationData;
  metadata?: {
    timestamp: string;
  };
}

// =============================================================================
// PARÁMETROS DE CONSULTA
// =============================================================================

export interface MapQueryParams {
  bounds?: BoundingBox;
  zoom?: number;
  fecha?: string;
  producto?: string;
}
