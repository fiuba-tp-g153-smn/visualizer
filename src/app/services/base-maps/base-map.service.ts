import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import {
  BASEMAP_DIRECT_SOURCES,
  BASE_MAP_PREVIEW_CONFIG,
  MAP_CONFIG,
  buildBasemapProvidersUrl,
  buildBasemapTileUrl,
  formatAttribution,
  type BaseMapProviderDto,
  type BaseMapProvidersResponse,
} from '../../config';
import { STORAGE_KEYS } from '../../constants';
import { BaseMap } from '../../models';
import { LocalStorageService } from '../storage/local-storage.service';

export type BaseMapLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Base Map Service
 *
 * Owns the list of base map providers, the currently selected base map, and
 * persistence of that choice. The list is seeded from the client's static
 * `BASEMAP_DIRECT_SOURCES` table (so base maps render straight from upstream
 * even when the data-service is down) and refined in place by the backend
 * `/basemap/providers` response when it arrives.
 */
@Injectable({
  providedIn: 'root',
})
export class BaseMapService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(LocalStorageService);

  private readonly _providers = signal<ReadonlyArray<BaseMap>>([]);
  private readonly _currentBaseMap = signal<BaseMap | null>(null);
  private readonly _loadState = signal<BaseMapLoadState>('idle');

  readonly providers = this._providers.asReadonly();
  readonly currentBaseMap = this._currentBaseMap.asReadonly();
  readonly loadState = this._loadState.asReadonly();
  readonly hasProviders = computed(() => this._providers().length > 0);

  constructor() {
    effect(() => {
      const baseMap = this._currentBaseMap();
      if (baseMap) {
        this.saveBaseMapToStorage(baseMap.id);
      }
    });

    // Seed the picker and the current base map from the client's own static
    // provider table so base maps render (direct-from-upstream) with zero
    // dependency on the data-service — this also removes the /basemap/providers
    // round-trip from the LCP path (the first base-map tile is the LCP element).
    // The backend list, when it arrives, only refines this metadata in place
    // (see loadProviders); an outage never blanks the picker or the map.
    const staticProviders = this.buildStaticProviders();
    this._providers.set(staticProviders);
    this._currentBaseMap.set(this.resolveInitialBaseMap(staticProviders));

    this.loadProviders().subscribe();
  }

  /**
   * Build the full base-map list from the static `BASEMAP_DIRECT_SOURCES` table.
   * This is the offline baseline: every entry has a direct upstream tile source,
   * so the map works without the data-service (which is only a per-tile fallback).
   */
  private buildStaticProviders(): ReadonlyArray<BaseMap> {
    return Object.entries(BASEMAP_DIRECT_SOURCES).map(([id, source]) => ({
      id,
      name: source.name,
      url: buildBasemapTileUrl(id),
      attribution: formatAttribution(source.attribution),
      minZoom: source.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      maxNativeZoom: source.maxNativeZoom,
      previewZ: BASE_MAP_PREVIEW_CONFIG.z,
      previewX: BASE_MAP_PREVIEW_CONFIG.x,
      previewY: BASE_MAP_PREVIEW_CONFIG.y,
      directUrl: source.urlTemplate,
      isTms: source.isTms,
    }));
  }

  loadProviders(): Observable<ReadonlyArray<BaseMap>> {
    this._loadState.set('loading');
    return this.http.get<BaseMapProvidersResponse>(buildBasemapProvidersUrl()).pipe(
      map((response) => (response.providers ?? []).map(toBaseMap)),
      tap((providers) => {
        // Refine the static baseline only when the backend actually returns
        // providers; reconcile the current selection against the refreshed list.
        // An empty 200 leaves the static list untouched.
        if (providers.length > 0) {
          this._providers.set(providers);
          this._currentBaseMap.set(this.resolveInitialBaseMap(providers));
        }
        this._loadState.set('loaded');
      }),
      catchError((error) => {
        console.error('Failed to load base map providers:', error);
        // The data-service is unreachable, but base maps are fetched directly
        // from upstream — keep the static list and current selection intact.
        // Only surface 'error' in the impossible case of an empty static list.
        this._loadState.set(this._providers().length > 0 ? 'loaded' : 'error');
        return of<ReadonlyArray<BaseMap>>(this._providers());
      }),
    );
  }

  getAvailableBaseMaps(): ReadonlyArray<BaseMap> {
    return this._providers();
  }

  setBaseMap(baseMapId: string): void {
    const baseMap = this._providers().find((p) => p.id === baseMapId);
    if (!baseMap) {
      console.warn(`Base map '${baseMapId}' not found in loaded providers`);
      return;
    }
    this._currentBaseMap.set(baseMap);
  }

  getCurrentBaseMap(): BaseMap | null {
    return this._currentBaseMap();
  }

  private resolveInitialBaseMap(providers: ReadonlyArray<BaseMap>): BaseMap | null {
    if (providers.length === 0) return null;

    const storedId = this.readStoredBaseMapId();
    const stored = storedId ? providers.find((p) => p.id === storedId) : undefined;
    if (stored) return stored;

    const fallback = providers.find((p) => p.id === MAP_CONFIG.defaultBaseMapId);
    return fallback ?? providers[0];
  }

  private readStoredBaseMapId(): string | null {
    return this.storage.getString(STORAGE_KEYS.BASE_MAP);
  }

  private saveBaseMapToStorage(baseMapId: string): void {
    this.storage.setString(STORAGE_KEYS.BASE_MAP, baseMapId);
  }
}

function toBaseMap(dto: BaseMapProviderDto): BaseMap {
  const direct = BASEMAP_DIRECT_SOURCES[dto.id] ?? null;
  return {
    id: dto.id,
    name: dto.name,
    url: buildBasemapTileUrl(dto.id),
    attribution: formatAttribution(dto.attribution),
    minZoom: dto.min_zoom,
    // Display ceiling: layer stays visible up to the map's overall max zoom;
    // past maxNativeZoom Leaflet upscales rather than refetching.
    maxZoom: MAP_CONFIG.maxZoom,
    // Fetch ceiling: ride the backend relay all the way to the upstream
    // provider's maximum. Past `cache_max_zoom` the data-service hits the
    // upstream live; if offline, it returns a transparent PNG (never 404).
    maxNativeZoom: dto.max_zoom,
    previewZ: BASE_MAP_PREVIEW_CONFIG.z,
    previewX: BASE_MAP_PREVIEW_CONFIG.x,
    previewY: BASE_MAP_PREVIEW_CONFIG.y,
    directUrl: direct?.urlTemplate ?? null,
    isTms: direct?.isTms ?? false,
  };
}
