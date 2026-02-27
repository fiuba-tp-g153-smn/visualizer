import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import {
  LayerType,
  LayerCategory,
  WmsLayer,
  GoesTileLayerConfig,
  RadarTileLayerConfig,
  RadarTileLayer,
  TileLayerControls,
  GoesLayerControls,
  RadarLayerControls,
  WmsLayerControls,
} from '../../models';
import { NotificationService } from '../notifications/notification.service';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { buildTileUrl, MAP_CONFIG } from '../../config';
import {
  LAYER_RENDERING_CONFIG,
  IGN_WMS_BASE_CONFIG,
  IGN_WMS_WORKSPACE_URLS,
} from '../../config/layers';

/**
 * Service responsible for creating and managing Leaflet tile layers.
 *
 * This service:
 * - Creates Leaflet layers based on layer type (TILE vs WMS) and category
 * - Reacts to configuration changes from LayerConfigService
 * - Builds dynamic tile URLs using layer.id and tileset information
 * - Handles tile loading errors with user notifications
 * - Creates placeholder layers when configuration is not yet available
 *
 * The service uses a factory pattern to convert Layer models into
 * configured L.TileLayer instances appropriate for each layer type.
 */
@Injectable({
  providedIn: 'root',
})
export class LayerRenderService {
  private readonly notificationService = inject(NotificationService);
  private readonly layerConfigService = inject(LayerConfigService);
  private readonly layersService = inject(LayersService);

  // Track errors per layer to avoid notification spam
  private readonly errorTracker = new Map<string, number>();
  private readonly MAX_ERRORS_BEFORE_NOTIFY = 5;

  // Tile Layer Pool: cache of L.TileLayer instances for reuse
  private readonly layerPool = new Map<string, L.TileLayer>();

  // ============================================================================
  // Public Methods - Layer Creation
  // ============================================================================

  /**
   * Creates a Leaflet TileLayer for the given layer ID and controls.
   * Uses a pool to reuse layer instances when only visual properties (opacity) change.
   * Returns a placeholder layer if configuration is not yet available or layer not found.
   *
   * @param layerId - The layer identifier
   * @param controls - Current layer control state (opacity, timeIndex, elevation, etc.)
   * @returns A configured Leaflet TileLayer
   */
  createTileLayer(layerId: string, controls: TileLayerControls | WmsLayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);

    if (!layer) {
      console.warn(`Layer ${layerId} not found`);
      return this.createPlaceholderLayer();
    }

    // Generate a unique key for the pool based on layer data (not visual properties)
    const poolKey = this.generatePoolKey(layerId, controls);

    // Check if we already have a layer instance in the pool
    if (this.layerPool.has(poolKey)) {
      const cachedLayer = this.layerPool.get(poolKey)!;
      // Update only visual properties without recreating the layer
      const opacity = (controls.opacity ?? LAYER_RENDERING_CONFIG.defaultOpacity) / 100;
      cachedLayer.setOpacity(opacity);
      return cachedLayer;
    }

    // Create new layer if not in pool
    let tileLayer: L.TileLayer;
    switch (layer.type) {
      case LayerType.TILE:
        tileLayer = this.createDataTileLayer(layerId, controls as TileLayerControls);
        break;
      case LayerType.WMS:
        tileLayer = this.createWmsLayer(layerId, controls as WmsLayerControls);
        break;
      default:
        throw new Error(`Unsupported layer type for layer ${layerId}`);
    }

    // Store in pool for future reuse
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Creates a Leaflet TileLayer for a radar layer with a specific elevation.
   * This is used when multiple elevations are selected.
   *
   * @param layerId - The radar layer identifier
   * @param controls - Current layer control state
   * @param elevationId - The specific elevation ID to create a layer for
   * @returns A configured Leaflet TileLayer for that elevation
   */
  createRadarTileLayerForElevation(
    layerId: string,
    controls: RadarLayerControls,
    elevationId: string,
  ): L.TileLayer {
    // Generate pool key including the specific elevation
    const config = this.layerConfigService.getConfig(layerId) as RadarTileLayerConfig | undefined;
    if (!config) {
      return this.createPlaceholderLayer();
    }

    const tilesets = config.availableTilesets;
    const timeIndex =
      controls.playback.timeIndex ?? (tilesets.length > 0 ? tilesets.length - 1 : 0);
    const tilesetId = tilesets[timeIndex] ?? 'default';
    const poolKey = `${layerId}-${elevationId}-${tilesetId}`;

    // Check pool
    if (this.layerPool.has(poolKey)) {
      const cachedLayer = this.layerPool.get(poolKey)!;
      const opacity = (controls.opacity ?? LAYER_RENDERING_CONFIG.defaultOpacity) / 100;
      cachedLayer.setOpacity(opacity);
      return cachedLayer;
    }

    // Create new layer
    const tileLayer = this.createRadarTileLayer(layerId, controls, elevationId);
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Cleans old layers from the pool that are not in use.
   * @param activeKeys Set of keys (layerId-tilesetId) that MUST be kept
   */
  prunePool(activeKeys: Set<string>): void {
    for (const [key] of this.layerPool) {
      if (!activeKeys.has(key)) {
        this.layerPool.delete(key);
      }
    }
  }

  // ============================================================================
  // Private Methods - Tile Layer Factory
  // ============================================================================

  /**
   * Generates a unique pool key for a layer based on its data (not visual properties).
   * The key should change only when the actual tile data changes, not when visual
   * properties like opacity change.
   */
  private generatePoolKey(layerId: string, controls: TileLayerControls | WmsLayerControls): string {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer) return layerId;

    switch (layer.type) {
      case LayerType.TILE: {
        const tileControls = controls as TileLayerControls;
        switch (layer.category) {
          case LayerCategory.GOES_19: {
            const goesControls = tileControls as GoesLayerControls;
            const config = this.layerConfigService.getConfig(layerId) as
              | GoesTileLayerConfig
              | undefined;
            if (!config) return `${layerId}-placeholder`;

            const tilesets = config.availableTilesets;
            const timeIndex =
              goesControls.playback.timeIndex ?? (tilesets.length > 0 ? tilesets.length - 1 : 0);
            const tilesetId = tilesets[timeIndex] ?? 'default';
            return `${layerId}-${tilesetId}`;
          }
          case LayerCategory.RADAR: {
            const radarControls = tileControls as RadarLayerControls;
            const config = this.layerConfigService.getConfig(layerId) as
              | RadarTileLayerConfig
              | undefined;
            if (!config) return `${layerId}-placeholder`;

            const selectedElevationIds = radarControls.elevation.selectedElevationIds;
            // Pool key includes all selected elevations to detect changes
            const elevationsKey = selectedElevationIds.sort().join(',');

            const tilesets = config.availableTilesets;
            const timeIndex =
              radarControls.playback.timeIndex ?? (tilesets.length > 0 ? tilesets.length - 1 : 0);
            const tilesetId = tilesets[timeIndex] ?? 'default';
            return `${layerId}-[${elevationsKey}]-${tilesetId}`;
          }
          default:
            return layerId;
        }
      }
      case LayerType.WMS: {
        const wmsLayer = layer as WmsLayer;
        return `${layerId}-${wmsLayer.wmsLayerName}`;
      }
      default:
        return layerId;
    }
  }

  /**
   * Creates a data tile layer (GOES, Radar, etc.) based on category.
   * Note: For radar layers with multiple elevations, use createRadarTileLayerForElevation instead.
   */
  private createDataTileLayer(layerId: string, controls: TileLayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.TILE) {
      return this.createPlaceholderLayer();
    }

    switch (layer.category) {
      case LayerCategory.GOES_19:
        return this.createGoesTileLayer(layerId, controls as GoesLayerControls);
      case LayerCategory.RADAR:
        // Radar layers should be created via createRadarTileLayerForElevation in map-viewer
        console.warn('Radar layer should use createRadarTileLayerForElevation');
        return this.createPlaceholderLayer();
      default:
        throw new Error(`Unsupported tile layer category for layer ${layerId}`);
    }
  }

  /**
   * Creates a WMS layer based on category.
   */
  private createWmsLayer(layerId: string, controls: WmsLayerControls): L.TileLayer.WMS {
    const layer = this.layersService.getLayerById(layerId);
    if (!layer || layer.type !== LayerType.WMS) {
      throw new Error(`Layer ${layerId} is not a WMS layer`);
    }

    const wmsLayer = layer as WmsLayer;

    switch (wmsLayer.category) {
      case LayerCategory.IGN_WMS:
        return this.createIgnWmsLayer(wmsLayer, controls);
      default:
        throw new Error(`Unsupported WMS layer category for layer ${layerId}`);
    }
  }

  // ============================================================================
  // Private Methods - GOES Layer Creation
  // ============================================================================

  /**
   * Creates a tile layer for GOES-19 satellite imagery.
   * Reads configuration from LayerConfigService to get available tilesets.
   *
   * Returns a placeholder layer if configuration is not yet loaded.
   */
  private createGoesTileLayer(layerId: string, controls: GoesLayerControls): L.TileLayer {
    const config = this.layerConfigService.getConfig(layerId) as GoesTileLayerConfig | undefined;

    if (!config) {
      const layer = this.layersService.getLayerById(layerId);
      if (layer && layer.category === LayerCategory.GOES_19) {
        // Trigger async config load - this will update the config map
        this.layerConfigService.fetchLayerConfig(layer).subscribe({
          next: () => console.debug('✅ [LayerRenderer] GOES config loaded for', layerId),
          error: (err) => console.error('❌ [LayerRenderer] Failed to load GOES config:', err),
        });
      }
      return this.createPlaceholderLayer();
    }

    // Get the tileset ID for the current time index
    const tilesets = config.availableTilesets;
    // If timeIndex is undefined, use the latest period
    const timeIndex =
      controls.playback.timeIndex ?? (tilesets.length > 0 ? tilesets.length - 1 : 0);

    if (!tilesets || tilesets.length === 0 || timeIndex >= tilesets.length) {
      return this.createPlaceholderLayer();
    }

    const tilesetId = tilesets[timeIndex];
    const pathToTileset = `${layerId}/${tilesetId}`;
    const tileUrl = buildTileUrl(pathToTileset);

    const baseOptions = this.createBaseTileLayerOptions(controls.opacity);
    const tileLayer = L.tileLayer(tileUrl, {
      ...baseOptions,
      minNativeZoom: LAYER_RENDERING_CONFIG.goes.minNativeZoom,
      maxNativeZoom: LAYER_RENDERING_CONFIG.goes.maxNativeZoom,
      bounds: LAYER_RENDERING_CONFIG.goes.bounds,
    });

    this.attachErrorHandlers(tileLayer, layerId);
    return tileLayer;
  }

  // ============================================================================
  // Private Methods - Radar Layer Creation
  // ============================================================================

  /**
   * Creates a tile layer for radar imagery with a specific elevation.
   * Reads configuration from LayerConfigService to get available tilesets (shared across elevations).
   *
   * Returns a placeholder layer if configuration is not yet loaded.
   */
  private createRadarTileLayer(
    layerId: string,
    controls: RadarLayerControls,
    elevationId: string,
  ): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);
    const config = this.layerConfigService.getConfig(layerId) as RadarTileLayerConfig | undefined;

    if (!layer || layer.type !== LayerType.TILE) {
      return this.createPlaceholderLayer();
    }

    if (!config) {
      if (layer.category === LayerCategory.RADAR) {
        // Trigger async config load - this will update the config map
        this.layerConfigService.fetchLayerConfig(layer).subscribe({
          next: () => console.debug('✅ [LayerRenderer] Radar config loaded for', layerId),
          error: (err) => console.error('❌ [LayerRenderer] Failed to load Radar config:', err),
        });
      }
      return this.createPlaceholderLayer();
    }

    const radarLayer = layer as RadarTileLayer;

    // Find the elevation object by ID
    const elevation = radarLayer.availableElevations.find((e) => e.id === elevationId);
    if (!elevation) {
      console.warn(`Elevation ${elevationId} not found for layer ${layerId}`);
      return this.createPlaceholderLayer();
    }

    // Get tilesets (now shared across all elevations)
    const tilesets = config.availableTilesets;
    if (!tilesets || tilesets.length === 0) {
      return this.createPlaceholderLayer();
    }

    // Get the tileset ID for the current time index
    // If timeIndex is undefined, use the latest period
    const timeIndex =
      controls.playback.timeIndex ?? (tilesets.length > 0 ? tilesets.length - 1 : 0);

    if (timeIndex >= tilesets.length) {
      return this.createPlaceholderLayer();
    }

    const tilesetId = tilesets[timeIndex];
    const pathToTileset = `${layerId}/${elevation.id}/${tilesetId}`;
    const tileUrl = buildTileUrl(pathToTileset);

    const baseOptions = this.createBaseTileLayerOptions(controls.opacity);
    const tileLayer = L.tileLayer(tileUrl, {
      ...baseOptions,
      minNativeZoom: LAYER_RENDERING_CONFIG.radar.minNativeZoom,
      maxNativeZoom: LAYER_RENDERING_CONFIG.radar.maxNativeZoom,
      bounds: LAYER_RENDERING_CONFIG.radar.bounds,
      tms: true, // Use TMS tile scheme (Y axis inverted compared to XYZ)
    });

    this.attachErrorHandlers(tileLayer, layerId + '#' + elevationId);
    return tileLayer;
  }

  // ============================================================================
  // Private Methods - WMS Layer Creation
  // ============================================================================

  /**
   * Creates a WMS tile layer for IGN (Instituto Geográfico Nacional) layers.
   * Uses configured WMS workspace or defaults to main IGN endpoint.
   */
  private createIgnWmsLayer(layer: WmsLayer, controls: WmsLayerControls): L.TileLayer.WMS {
    const url = layer.wmsWorkspace
      ? IGN_WMS_WORKSPACE_URLS[layer.wmsWorkspace] || IGN_WMS_BASE_CONFIG.defaultUrl
      : IGN_WMS_BASE_CONFIG.defaultUrl;

    const wmsLayer = L.tileLayer.wms(url, {
      layers: layer.wmsLayerName,
      format: IGN_WMS_BASE_CONFIG.format,
      transparent: IGN_WMS_BASE_CONFIG.transparent,
      version: IGN_WMS_BASE_CONFIG.version,
      crs: L.CRS.EPSG3857,
      opacity: (controls.opacity ?? LAYER_RENDERING_CONFIG.defaultOpacity) / 100,
    });

    this.attachErrorHandlers(wmsLayer, layer.id);
    return wmsLayer;
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Creates base tile layer options using global map configuration.
   * These options are common to all tile layers.
   */
  private createBaseTileLayerOptions(opacity?: number): L.TileLayerOptions {
    return {
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      noWrap: true,
      opacity: (opacity ?? LAYER_RENDERING_CONFIG.defaultOpacity) / 100,
    };
  }

  /**
   * Creates a placeholder layer shown while configuration is loading.
   * Uses a transparent blank tile to avoid errors.
   */
  private createPlaceholderLayer(): L.TileLayer {
    const placeholder = L.tileLayer('about:blank', {
      opacity: 0,
    });

    // Mark as placeholder so we don't attach error handlers
    (placeholder as any)._isPlaceholder = true;
    return placeholder;
  }

  /**
   * Attaches error and success handlers to a tile layer for monitoring.
   * Tracks errors and shows user notifications after repeated failures.
   */
  private attachErrorHandlers(tileLayer: L.TileLayer, layerId: string): void {
    const layerName = this.layersService.getLayerDisplayName(layerId);
    let errorCount = 0;

    tileLayer.on('tileerror', (error: L.TileErrorEvent) => {
      errorCount++;
      console.warn(
        `Error loading tile for ${layerName}:`,
        error.error,
        `(${errorCount}/${this.MAX_ERRORS_BEFORE_NOTIFY})`,
      );

      // After several consecutive errors, notify the user
      if (errorCount >= this.MAX_ERRORS_BEFORE_NOTIFY) {
        const currentErrors = this.errorTracker.get(layerId) || 0;

        // Only notify once to avoid spam
        if (currentErrors === 0) {
          this.notificationService.error(
            `La capa "${layerName}" no está disponible temporalmente. Verificá la conexión con el servidor.`,
            layerId,
          );
        }

        this.errorTracker.set(layerId, currentErrors + 1);
        errorCount = 0; // Reset for next batch
      }
    });

    // If tiles start loading successfully, reset error tracking
    tileLayer.on('tileload', () => {
      if (errorCount > 0) {
        errorCount = Math.max(0, errorCount - 1);
      }

      // If there were previous errors, clear them and log recovery
      if (this.errorTracker.has(layerId)) {
        console.info(`✅ Layer ${layerName} recovered`);
        this.errorTracker.delete(layerId);
      }
    });
  }
}
