import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { buildConfigUrl } from '../../config';
import {
  Layer,
  LayerConfig,
  LayerCategory,
  RadarTileLayerConfig,
  GoesTileLayer,
  LayerType,
  RadarTileLayer,
  GoesTileLayerConfig,
} from '../../models';

/**
 * Service responsible for fetching and caching layer configurations.
 *
 * This service handles:
 * - Fetching layer configurations from the backend API
 * - Maintaining a reactive signal-based cache of configurations
 * - Providing type-safe accessors for different layer types
 * - Managing HTTP requests for GOES and Radar layers with different structures
 *
 * GOES layers have a single list of available tilesets, while Radar layers
 * organize tilesets by elevation angle (0.5°, 1.0°, etc.).
 */
@Injectable({
  providedIn: 'root',
})
export class LayerConfigService {
  private readonly http = inject(HttpClient);
  private readonly configMap = signal<Map<string, LayerConfig>>(new Map());

  // ============================================================================
  // Public Signals
  // ============================================================================

  /**
   * Read-only signal containing all layer configurations.
   * Other services can subscribe to this for reactive updates.
   */
  readonly configs = this.configMap.asReadonly();

  // ============================================================================
  // Public Methods - Fetching
  // ============================================================================

  /**
   * Fetches and updates the configuration for a GOES satellite layer.
   * Makes a single HTTP request to get available tilesets.
   */
  fetchGoesLayerConfig(layer: GoesTileLayer): Observable<GoesTileLayerConfig> {
    const configUrl = buildConfigUrl(layer.id);
    return this.http.get<GoesTileLayerConfig>(configUrl).pipe(
      map((config) => {
        const layerConfig: GoesTileLayerConfig = {
          layerId: layer.id,
          type: LayerType.TILE,
          category: LayerCategory.GOES_19,
          availableTilesets: config.availableTilesets,
        };

        this.updateConfigMap(layer.id, layerConfig);
        return layerConfig;
      }),
      catchError((error) => {
        console.error(`Failed to fetch config for layer ${layer.id}:`, error);
        throw error;
      }),
    );
  }

  /**
   * Fetches and updates the configuration for a radar layer.
   * Makes parallel HTTP requests (one per elevation angle) and combines results.
   * Returns an empty configuration if no elevations are available.
   */
  fetchRadarLayerConfig(layer: RadarTileLayer): Observable<RadarTileLayerConfig> {
    if (!layer.availableElevations || layer.availableElevations.length === 0) {
      const emptyConfig: RadarTileLayerConfig = {
        layerId: layer.id,
        type: LayerType.TILE,
        category: LayerCategory.RADAR,
        availableTilesetsByElevation: {},
      };
      return of(emptyConfig);
    }

    const elevationRequests = layer.availableElevations.map((elevation) => {
      const pathToProduct = `${layer.id}/${elevation}`;
      const configUrl = buildConfigUrl(pathToProduct);
      return this.http.get<{ tilesets: string[] }>(configUrl).pipe(
        map((response) => ({ elevation, tilesets: response.tilesets })),
        catchError((error) => {
          console.error(`Failed to fetch radar config for ${pathToProduct}:`, error);
          throw error;
        }),
      );
    });

    return forkJoin(elevationRequests).pipe(
      map((results) => {
        const availableTilesetsByElevation: Record<string, string[]> = {};
        results.forEach(({ elevation, tilesets }) => {
          availableTilesetsByElevation[elevation] = tilesets;
        });

        const config: RadarTileLayerConfig = {
          layerId: layer.id,
          type: LayerType.TILE,
          category: LayerCategory.RADAR,
          availableTilesetsByElevation,
        };

        this.updateConfigMap(layer.id, config);
        return config;
      }),
    );
  }

  /**
   * Main entry point to fetch layer configuration.
   * Dispatches to the appropriate method based on layer category.
   *
   * @throws Error if the layer category doesn't require tileset configuration
   */
  fetchLayerConfig(layer: Layer): Observable<LayerConfig> {
    switch (layer.category) {
      case LayerCategory.GOES_19:
        return this.fetchGoesLayerConfig(layer as GoesTileLayer);
      case LayerCategory.RADAR:
        return this.fetchRadarLayerConfig(layer as RadarTileLayer);
      default:
        throw new Error(`Layer category ${layer.category} does not require tileset configuration`);
    }
  }

  // ============================================================================
  // Public Methods - Getters
  // ============================================================================

  /**
   * Gets the configuration for a specific layer from the cache.
   * Returns undefined if the configuration hasn't been fetched yet.
   */
  getConfig(layerId: string): LayerConfig | undefined {
    return this.configMap().get(layerId);
  }

  /**
   * Checks if a configuration exists for the given layer in the cache.
   */
  hasConfig(layerId: string): boolean {
    return this.configMap().has(layerId);
  }

  /**
   * Gets available tilesets for GOES layers.
   * Returns undefined if the layer is not a GOES layer or hasn't been configured.
   */
  getAvailableTilesets(layerId: string): string[] | undefined {
    const config = this.getConfig(layerId);
    if (!config) return undefined;

    switch (config.type) {
      case LayerType.TILE:
        switch (config.category) {
          case LayerCategory.GOES_19:
            return config.availableTilesets;
          default:
            return undefined;
        }
      default:
        return undefined;
    }
  }

  /**
   * Gets available tilesets organized by elevation angle for radar layers.
   * Returns undefined if the layer is not a radar layer or hasn't been configured.
   */
  getAvailableTilesetsByElevation(layerId: string): Record<string, string[]> | undefined {
    const config = this.getConfig(layerId);
    if (!config) return undefined;

    switch (config.type) {
      case LayerType.TILE:
        switch (config.category) {
          case LayerCategory.RADAR:
            return config.availableTilesetsByElevation;
          default:
            return undefined;
        }
      default:
        return undefined;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Updates the configuration map with a new configuration.
   * Creates a new immutable map to trigger reactive updates.
   */
  private updateConfigMap(layerId: string, config: LayerConfig): void {
    this.configMap.update((map) => {
      const newMap = new Map(map);
      newMap.set(layerId, config);
      return newMap;
    });
  }
}
