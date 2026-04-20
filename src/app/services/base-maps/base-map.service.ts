import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import {
  BASE_MAP_PREVIEW_CONFIG,
  MAP_CONFIG,
  buildBasemapProvidersUrl,
  buildBasemapTileUrl,
  formatAttribution,
  type BaseMapProviderDto,
  type BaseMapProvidersResponse,
} from '../../config';
import { BaseMap } from '../../models';

const BASE_MAP_LOCAL_STORAGE_KEY = 'mapasmn_selected_base_map';

export type BaseMapLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Base Map Service
 *
 * Owns the list of base map providers (sourced from the backend at runtime),
 * the currently selected base map, and persistence of that choice.
 */
@Injectable({
  providedIn: 'root',
})
export class BaseMapService {
  private readonly http = inject(HttpClient);

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

    this.loadProviders().subscribe();
  }

  /**
   * Fetches `/basemap/providers` and resolves the current selection from the
   * returned list. Idempotent — safe to call again to refresh.
   */
  loadProviders(): Observable<ReadonlyArray<BaseMap>> {
    this._loadState.set('loading');
    return this.http.get<BaseMapProvidersResponse>(buildBasemapProvidersUrl()).pipe(
      map((response) => (response.providers ?? []).map(toBaseMap)),
      catchError((error) => {
        console.error('Failed to load base map providers:', error);
        this._loadState.set('error');
        return of<ReadonlyArray<BaseMap>>([]);
      }),
      map((providers) => {
        this._providers.set(providers);
        this._currentBaseMap.set(this.resolveInitialBaseMap(providers));
        if (this._loadState() !== 'error') this._loadState.set('loaded');
        return providers;
      }),
    );
  }

  /**
   * Returns the loaded base maps. Empty until `loadProviders` resolves.
   */
  getAvailableBaseMaps(): ReadonlyArray<BaseMap> {
    return this._providers();
  }

  /**
   * Selects a base map by id. No-op (with a warning) if the id is not in the
   * loaded provider list — never call the tile endpoint for an unknown id.
   */
  setBaseMap(baseMapId: string): void {
    const baseMap = this._providers().find((p) => p.id === baseMapId);
    if (!baseMap) {
      console.warn(`Base map '${baseMapId}' not found in loaded providers`);
      return;
    }
    this._currentBaseMap.set(baseMap);
    console.log('🗺️ Base map changed to:', baseMap.name);
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
    try {
      return localStorage.getItem(BASE_MAP_LOCAL_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to read base map from storage:', error);
      return null;
    }
  }

  private saveBaseMapToStorage(baseMapId: string): void {
    try {
      localStorage.setItem(BASE_MAP_LOCAL_STORAGE_KEY, baseMapId);
    } catch (error) {
      console.warn('Failed to save base map to storage:', error);
    }
  }
}

function toBaseMap(dto: BaseMapProviderDto): BaseMap {
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
  };
}
