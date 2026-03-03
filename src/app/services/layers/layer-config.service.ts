import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';
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
import { LayersService } from './layers.service';

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
  private readonly layersService = inject(LayersService);
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
        // Extract only the IDs from the tileset objects and sort chronologically
        const availableTilesets = response.tilesets.map((tileset: any) => tileset.id).sort();

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
   * Makes a single HTTP request (tilesets are now shared across elevations).
   * Returns an empty configuration if no elevations are available.
   */
  fetchRadarLayerConfig(layer: RadarTileLayer): Observable<RadarTileLayerConfig> {
    if (!layer.availableElevations || layer.availableElevations.length === 0) {
      const emptyConfig: RadarTileLayerConfig = {
        layerId: layer.id,
        type: LayerType.TILE,
        category: LayerCategory.RADAR,
        availableTilesets: [],
      };
      return of(emptyConfig);
    }

    // Fetch from first elevation (tilesets are shared across all elevations now)
    const firstElevation = layer.availableElevations[0];
    const pathToProduct = `${layer.id}/${firstElevation.id}`;
    const configUrl = buildConfigUrl(pathToProduct);

    return this.http.get<any>(configUrl).pipe(
      map((response) => {
        // Sort tilesets chronologically
        const availableTilesets = (response.tilesets || []).sort();

        const config: RadarTileLayerConfig = {
          layerId: layer.id,
          type: LayerType.TILE,
          category: LayerCategory.RADAR,
          availableTilesets,
        };
        this.updateConfigMap(layer.id, config);
        return config;
      }),
      catchError((error) => {
        console.error(`Failed to fetch radar config for ${pathToProduct}:`, error);
        throw error;
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
   * Gets available tilesets for tile layers.
   * Returns undefined if config not yet loaded.
   * @throws Error if called on non-TILE layer
   */
  getAvailableTilesets(layerId: string): string[] | undefined {
    const config = this.getConfig(layerId);
    if (!config) return undefined;

    switch (config.type) {
      case LayerType.TILE:
        return config.availableTilesets;
      default:
        throw new Error(
          `Cannot get available tilesets for non-TILE layer '${layerId}' (type: ${config.type})`,
        );
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
        const bTile = b as GoesTileLayerConfig | RadarTileLayerConfig;
        return this.arraysAreEqual(a.availableTilesets, bTile.availableTilesets);
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
   * Calculates the optimal timeIndex for a given range of images.
   * @param layerId - The layer ID
   * @param lastImagesCount - Number of most recent images to include
   * @returns The calculated timeIndex, or undefined if config not available
   * @throws Error if called on non-TILE layer or no tilesets available
   */
  calculateTimeIndexForRange(layerId: string, lastImagesCount: number): number | undefined {
    const config = this.getConfig(layerId);
    if (!config) return undefined;

    switch (config.type) {
      case LayerType.TILE: {
        const maxIndex = config.availableTilesets.length - 1;

        if (maxIndex < 0) {
          throw new Error(`No tilesets available for layer '${layerId}'`);
        }

        if (lastImagesCount === 1) {
          // Go to the latest period
          return maxIndex;
        } else {
          // Go to the start of the lastImagesCount range
          return Math.max(0, maxIndex - lastImagesCount + 1);
        }
      }
      default:
        throw new Error(
          `Cannot calculate time index for non-TILE layer '${layerId}' (type: ${config.type})`,
        );
    }
  }
}
