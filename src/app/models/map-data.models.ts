/**
 * Modelos de datos del backend (datos crudos de la API)
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
// TILES XYZ (Satelitales pre-procesados con gdal2tiles)
// =============================================================================

/**
 * Datos de tile layer (tiles dinámicos en formato z/x/y)
 * Usados para satélites y otros datos geoespaciales servidos como tiles
 */
export interface TileLayerData {
  id: string;
  name: string;
  productName: string; // Nombre del producto en el backend
  urlTemplate: string; // Template: 'http://localhost:5000/tiles/{product}/{z}/{x}/{y}.webp'
  minZoom: number;
  maxZoom: number;
  opacity?: number;
  bounds?: BoundingBox;
  attribution?: string;
  metadata?: {
    timestamp?: string;
    producto?: string;
    channel?: 'ch2' | 'ch9' | 'ch13'; // Canales ABI
    satelite?: string; // ej: 'GOES-16'
  };
}

/**
 * Producto de tiles disponible en el backend
 */
export interface TileProduct {
  name: string; // Nombre único del producto
  path: string; // Path en el servidor
  tile_format: string; // 'webp' | 'png'
  zoom_levels: number[]; // Niveles de zoom disponibles
}

/**
 * Respuesta del endpoint de productos de tiles
 */
export interface TileProductsResponse {
  products: TileProduct[];
  tile_url_template: string;
}
