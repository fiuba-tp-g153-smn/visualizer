import type { Geometry } from 'geojson';

/**
 * Place returned by the IGN gazetteer search (`buscador`).
 */
export interface IgnPlace {
  id: number;
  type: string;
  name: string;
  depto: string;
  pcia: string;
  rank: number;
  point: GeoPoint;
}

/** Raw response entry from the IGN gazetteer search endpoint (`format=full`, GeoJSON `Feature`). */
export interface IgnPlaceSearchResult {
  geometry: { coordinates: readonly [number, number] };
  properties: {
    id: number;
    type: string;
    name: string;
    depto: string;
    pcia: string;
    rank: number;
  };
}

/** Geographic point in decimal degrees. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Place returned by the Nominatim (OpenStreetMap) search endpoint.
 * Unlike the IGN gazetteer, it resolves coordinates directly and can
 * optionally include the place's boundary as GeoJSON.
 */
export interface NominatimPlace {
  id: number;
  displayName: string;
  category: string;
  type: string;
  point: GeoPoint;
  /** Boundary geometry, present only when the result represents an area (not a single point). */
  geometry: Geometry | null;
}

/** Raw response entry from the Nominatim search endpoint (`format=jsonv2`). */
export interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  category: string;
  type: string;
  lat: string;
  lon: string;
  geojson?: Geometry;
}

/** Selectable place-search providers backing the search tab. */
export type PlaceSearchSource = 'ign' | 'nominatim';

/** How an area result from Nominatim should be marked on the map. */
export type NominatimDisplayMode = 'polygon' | 'marker';
