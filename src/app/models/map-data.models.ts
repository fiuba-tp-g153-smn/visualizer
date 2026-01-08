/**
 * Modelos de datos para capas del mapa
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
// IMÁGENES RASTER (Satelitales)
// =============================================================================

export interface RasterImageData {
  id: string;
  name: string;
  imageUrl: string; // URL de la imagen para superponer
  bounds: BoundingBox; // Límites geográficos de la imagen
  opacity?: number;
  metadata?: {
    fecha?: string;
    canal?: string;
    satelite?: string;
  };
}
