/**
 * Modelos de datos del backend (datos crudos de la API)
 * Por ahora minimalista, se expandirá según necesidad
 */

// Tipos base para coordenadas y bounds
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

// TODO: Agregar aquí tipos específicos de datos del backend cuando se necesiten:
// - EmaPointData (estaciones meteorológicas)
// - WRFData (modelos numéricos)
// - RadarData, etc.
