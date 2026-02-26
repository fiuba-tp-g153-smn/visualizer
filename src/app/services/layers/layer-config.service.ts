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
  RadarElevation,
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
    return this.http.get<any>(configUrl).pipe(
      map((response) => {
        // Extract only the IDs from the tileset objects
        const availableTilesets = response.tilesets.map((tileset: any) => tileset.id);

        const layerConfig: GoesTileLayerConfig = {
          layerId: layer.id,
          type: LayerType.TILE,
          category: LayerCategory.GOES_19,
          availableTilesets,
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
      return this.http.get<any>(configUrl).pipe(
        map((response) => {
          // Extract only the IDs from the tileset objects
          const tilesets = response.tilesets.map((tileset: any) => tileset.id);
          return { elevation, tilesets };
        }),
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
          availableTilesetsByElevation[elevation.id] = tilesets;
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
   * Only updates if the configuration has actually changed to avoid unnecessary reactive updates.
   */
  private updateConfigMap(layerId: string, config: LayerConfig): void {
    const existingConfig = this.configMap().get(layerId);

    // Compare configs to see if they're actually different
    if (existingConfig && this.configsAreEqual(existingConfig, config)) return;

    this.configMap.update((map) => {
      const newMap = new Map(map);
      newMap.set(layerId, config);
      return newMap;
    });
  }

  /**
   * Compares two layer configurations to determine if they're equal.
   */
  private configsAreEqual(a: LayerConfig, b: LayerConfig): boolean {
    if (a.type !== b.type) return false;

    switch (a.type) {
      case LayerType.TILE:
        if (a.category !== (b as any).category) return false;

        switch (a.category) {
          case LayerCategory.GOES_19: {
            const bGoes = b as GoesTileLayerConfig;
            return this.arraysAreEqual(a.availableTilesets, bGoes.availableTilesets);
          }
          case LayerCategory.RADAR: {
            const bRadar = b as RadarTileLayerConfig;
            // Compare elevation keys
            const aKeys = Object.keys(a.availableTilesetsByElevation).sort();
            const bKeys = Object.keys(bRadar.availableTilesetsByElevation).sort();
            if (!this.arraysAreEqual(aKeys, bKeys)) return false;

            // Compare tilesets for each elevation
            for (const key of aKeys) {
              if (
                !this.arraysAreEqual(
                  a.availableTilesetsByElevation[key],
                  bRadar.availableTilesetsByElevation[key],
                )
              ) {
                return false;
              }
            }
            return true;
          }
          default:
            return false;
        }
      default:
        return false;
    }
  }

  /**
   * Compares two arrays for equality.
   */
  private arraysAreEqual(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ============================================================================
  // Public Methods - TimeIndex Calculation
  // ============================================================================

  /**
   * Calculates the optimal timeIndex based on lastImagesCount and available periods.
   * - If lastImagesCount = 1: returns the latest period (maxIndex)
   * - If lastImagesCount > 1: returns the start of the range (maxIndex - lastImagesCount + 1) or 0
   *
   * @param layerId - The layer ID
   * @param lastImagesCount - Number of recent images to display
   * @param elevationKey - For radar layers, the elevation angle key (e.g., "0.5")
   * @returns The calculated timeIndex, or undefined if config is not available
   */
  calculateTimeIndexForRange(
    layerId: string,
    lastImagesCount: number,
    elevation?: RadarElevation,
  ): number | undefined {
    const config = this.getConfig(layerId);
    if (!config || config.type !== LayerType.TILE) {
      return undefined;
    }

    let maxIndex = 0;

    switch (config.category) {
      case LayerCategory.GOES_19: {
        maxIndex = config.availableTilesets.length - 1;
        break;
      }
      case LayerCategory.RADAR: {
        if (!elevation) {
          return undefined;
        }
        const tilesets = config.availableTilesetsByElevation[elevation.id];
        if (!tilesets || tilesets.length === 0) {
          return undefined;
        }
        maxIndex = tilesets.length - 1;
        break;
      }
      default:
        return undefined;
    }

    if (maxIndex < 0) {
      return undefined;
    }

    if (lastImagesCount === 1) {
      // Go to the latest period
      return maxIndex;
    } else {
      // Go to the start of the lastImagesCount range
      return Math.max(0, maxIndex - lastImagesCount + 1);
    }
  }
}
