/**
 * Modelo de proveedor de tiles para mapas base
 */

export interface TileProvider {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom?: number;
}
