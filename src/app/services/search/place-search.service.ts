import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  IgnPlace,
  IgnPlaceSearchResult,
  NominatimPlace,
  NominatimSearchResult,
} from '../../models';

const IGN_PLACE_SEARCH_URL = environment.placeSearch.ignUrl;

const NOMINATIM_SEARCH_URL = environment.placeSearch.nominatimUrl;

/** Restrict Nominatim results to Argentina, mirroring the IGN gazetteer's scope. */
const NOMINATIM_COUNTRY_CODES = 'ar';
const NOMINATIM_LANGUAGE = 'es';

function toIgnPlace(result: IgnPlaceSearchResult): IgnPlace {
  const [lon, lat] = result.geometry.coordinates;

  return {
    ...result.properties,
    point: { lat, lon },
  };
}

function toNominatimPlace(result: NominatimSearchResult): NominatimPlace {
  return {
    id: result.place_id,
    displayName: result.display_name,
    category: result.category,
    type: result.type,
    point: { lat: parseFloat(result.lat), lon: parseFloat(result.lon) },
    // A bare `Point` geometry duplicates `point` and isn't worth drawing as a boundary.
    geometry: result.geojson && result.geojson.type !== 'Point' ? result.geojson : null,
  };
}

/**
 * Thin client for two place-search providers, both of which resolve
 * coordinates directly:
 * - the IGN gazetteer (`buscador`, queried with `format=full` for its GeoJSON
 *   centroid) — Argentina-specific, ranked by relevance;
 * - Nominatim (OpenStreetMap), which can also return a place's boundary as
 *   GeoJSON for area/polygon results.
 * Experimental: external APIs consumed directly, no caching/retry beyond defaults.
 */
@Injectable({ providedIn: 'root' })
export class PlaceSearchService {
  private readonly http = inject(HttpClient);

  search(term: string, limit: number): Observable<IgnPlace[]> {
    const params = new HttpParams()
      .set('q', term)
      .set('limit', limit.toString())
      .set('format', 'full');

    return this.http
      .get<IgnPlaceSearchResult[]>(IGN_PLACE_SEARCH_URL, { params })
      .pipe(map((results) => results.map(toIgnPlace)));
  }

  searchNominatim(term: string, limit: number): Observable<NominatimPlace[]> {
    const params = new HttpParams()
      .set('q', term)
      .set('format', 'jsonv2')
      .set('polygon_geojson', '1')
      .set('addressdetails', '0')
      .set('countrycodes', NOMINATIM_COUNTRY_CODES)
      .set('accept-language', NOMINATIM_LANGUAGE)
      .set('limit', limit.toString());

    return this.http
      .get<NominatimSearchResult[]>(NOMINATIM_SEARCH_URL, { params })
      .pipe(map((results) => results.map(toNominatimPlace)));
  }
}
