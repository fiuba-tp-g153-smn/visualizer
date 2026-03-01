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
  TileLayer,
  Layer,
  LayerControls,
} from '../../models';
import { NotificationService } from '../notifications/notification.service';
import { LayerConfigService } from './layer-config.service';
import { LayersService } from './layers.service';
import { buildTileUrl, MAP_CONFIG } from '../../config';
import { IGN_WMS_BASE_CONFIG, IGN_WMS_WORKSPACE_URLS } from '../../config/layers';

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
  createTileLayer(layerId: string, controls: LayerControls): L.TileLayer {
    const layer = this.layersService.getLayerById(layerId);

    if (!layer) {
      console.warn(`Layer ${layerId} not found`);
      return this.createPlaceholderLayer();
    }

    // Generate a unique key for the pool based on layer data (not visual properties)
    const poolKey = this.generatePoolKey(layerId, controls);

    // Check if we already have a layer instance in the pool
    if (this.layerPool.has(poolKey)) {
      // Return cached layer as-is; caller (map-viewer) manages opacity
      return this.layerPool.get(poolKey)!;
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
      // Return cached layer as-is; caller (map-viewer) manages opacity
      return this.layerPool.get(poolKey)!;
    }

    // Create new layer
    const tileLayer = this.createRadarTileLayer(layerId, controls, elevationId);
    this.layerPool.set(poolKey, tileLayer);
    return tileLayer;
  }

  /**
   * Returns the number of available tilesets for a TILE layer (GOES or Radar).
   * Used by map-viewer to determine valid prefetch index bounds.
   */
  getAvailableTilesetsCount(layerId: string): number {
    const config = this.layerConfigService.getConfig(layerId) as
      | GoesTileLayerConfig
      | RadarTileLayerConfig
      | undefined;
    return config?.availableTilesets.length ?? 0;
  }

  /**
   * Creates or retrieves a GOES tile layer for a specific timeIndex, ignoring opacity.
   * Used for pre-fetching adjacent frames without affecting the displayed opacity.
   */
  createTileLayerForTimeIndex(
    layerId: string,
    controls: GoesLayerControls,
    timeIndex: number,
  ): L.TileLayer {
    const overrideControls: GoesLayerControls = {
      ...controls,
      playback: { ...controls.playback, timeIndex },
    };
    return this.createTileLayer(layerId, overrideControls);
  }

  /**
   * Creates or retrieves a radar tile layer for a specific elevation and timeIndex, ignoring opacity.
   * Used for pre-fetching adjacent frames without affecting the displayed opacity.
   */
  createRadarTileLayerForElevationAtTimeIndex(
    layerId: string,
    controls: RadarLayerControls,
    elevationId: string,
    timeIndex: number,
  ): L.TileLayer {
    const overrideControls: RadarLayerControls = {
      ...controls,
      playback: { ...controls.playback, timeIndex },
    };
    return this.createRadarTileLayerForElevation(layerId, overrideControls, elevationId);
  }

  /**
   * Creates GOES layers for playback including current frame and prerendered next frames.
   * Returns a map of composite keys to layers with opacity already set.
   *
   * @param layerId - The GOES layer identifier
   * @param controls - Current layer control state
   * @param targetOpacity - Target opacity for the current visible frame (0-1)
   * @param absoluteZIndex - Z-index to apply to all layers
   * @returns Map of composite keys (layerId#timeIndex) to layer objects
   */
  createGoesLayersForPlayback(
    layerId: string,
    controls: GoesLayerControls,
    targetOpacity: number,
    absoluteZIndex: number,
  ): Map<string, L.TileLayer> {
    const result = new Map<string, L.TileLayer>();
    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const totalFrames = this.getAvailableTilesetsCount(layerId);

    // Current visible frame
    const tileLayer = this.createTileLayer(layerId, controls);
    this.applyLayerStyles(tileLayer, targetOpacity, absoluteZIndex);
    result.set(`${layerId}#${currentTimeIndex}`, tileLayer);

    // Pre-render next N frames at opacity=0
    this.prerenderNextFrames(
      result,
      currentTimeIndex,
      totalFrames,
      controls.playback.lastImagesCount,
      absoluteZIndex,
      (adjIndex) => {
        const adjLayer = this.createTileLayerForTimeIndex(layerId, controls, adjIndex);
        return { layer: adjLayer, key: `${layerId}#${adjIndex}` };
      },
    );

    return result;
  }

  /**
   * Creates radar layers for playback including current frame and prerendered next frames.
   * Returns a map of composite keys to layers with opacity already set.
   * One layer per selected elevation.
   *
   * @param layerId - The radar layer identifier
   * @param controls - Current layer control state
   * @param targetOpacity - Target opacity for the current visible frames (0-1)
   * @param absoluteZIndex - Z-index to apply to all layers
   * @returns Map of composite keys (layerId#elevationId#timeIndex) to layer objects
   */
  createRadarLayersForPlayback(
    layerId: string,
    controls: RadarLayerControls,
    targetOpacity: number,
    absoluteZIndex: number,
  ): Map<string, L.TileLayer> {
    const result = new Map<string, L.TileLayer>();
    const selectedElevationIds = controls.elevation.selectedElevationIds || [];
    const currentTimeIndex = controls.playback.timeIndex ?? 0;
    const totalFrames = this.getAvailableTilesetsCount(layerId);

    for (const elevationId of selectedElevationIds) {
      // Current visible frame for this elevation
      const tileLayer = this.createRadarTileLayerForElevation(layerId, controls, elevationId);
      this.applyLayerStyles(tileLayer, targetOpacity, absoluteZIndex);
      result.set(`${layerId}#${elevationId}#${currentTimeIndex}`, tileLayer);

      // Pre-render next N frames at opacity=0 for this elevation
      this.prerenderNextFrames(
        result,
        currentTimeIndex,
        totalFrames,
        controls.playback.lastImagesCount,
        absoluteZIndex,
        (adjIndex) => {
          const adjLayer = this.createRadarTileLayerForElevationAtTimeIndex(
            layerId,
            controls,
            elevationId,
            adjIndex,
          );
          return { layer: adjLayer, key: `${layerId}#${elevationId}#${adjIndex}` };
        },
      );
    }

    return result;
  }

  /**
   * Applies opacity and z-index styles to a tile layer.
   */
  private applyLayerStyles(layer: L.TileLayer, opacity: number, zIndex: number): void {
    layer.setOpacity(opacity);
    layer.setZIndex(zIndex);
  }

  /**
   * Pre-renders next N frames at opacity=0 for smooth playback transitions.
   * Uses modular arithmetic to wrap around the animation window.
   */
  private prerenderNextFrames(
    result: Map<string, L.TileLayer>,
    currentTimeIndex: number,
    totalFrames: number,
    lastImagesCount: number,
    absoluteZIndex: number,
    createLayer: (timeIndex: number) => { layer: L.TileLayer; key: string },
  ): void {
    const minTimeIndex = Math.max(0, totalFrames - lastImagesCount);
    const windowSize = totalFrames - minTimeIndex;

    if (windowSize > 1) {
      for (let offset = 1; offset <= MAP_CONFIG.prerenderNextFrames; offset++) {
        const posInWindow = currentTimeIndex - minTimeIndex;
        const adjPosInWindow = (((posInWindow + offset) % windowSize) + windowSize) % windowSize;
        const adjIndex = minTimeIndex + adjPosInWindow;

        const { layer, key } = createLayer(adjIndex);
        this.applyLayerStyles(layer, 0, absoluteZIndex);
        result.set(key, layer);
      }
    }
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
  private generatePoolKey(layerId: string, controls: LayerControls): string {
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
    const layer = this.layersService.getLayerById(layerId);

    if (!layer || layer.type !== LayerType.TILE || layer.category !== LayerCategory.GOES_19) {
      return this.createPlaceholderLayer();
    }

    const tilesetId = this.getTilesetId(layerId, layer, controls.playback.timeIndex);
    if (!tilesetId) return this.createPlaceholderLayer();

    const pathToTileset = `${layerId}/${tilesetId}`;
    const tileUrl = buildTileUrl(pathToTileset);

    const tileLayer = this.buildTileLayer(tileUrl, layer, controls.opacity);
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

    if (!layer || layer.type !== LayerType.TILE) {
      return this.createPlaceholderLayer();
    }

    const radarLayer = layer as RadarTileLayer;

    // Find the elevation object by ID
    const elevation = radarLayer.availableElevations.find((e) => e.id === elevationId);
    if (!elevation) {
      console.warn(`Elevation ${elevationId} not found for layer ${layerId}`);
      return this.createPlaceholderLayer();
    }

    const tilesetId = this.getTilesetId(layerId, layer, controls.playback.timeIndex);
    if (!tilesetId) return this.createPlaceholderLayer();

    const pathToTileset = `${layerId}/${elevation.id}/${tilesetId}`;
    const tileUrl = buildTileUrl(pathToTileset);

    const tileLayer = this.buildTileLayer(tileUrl, layer, controls.opacity);
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
      opacity: controls.opacity,
    });

    this.attachErrorHandlers(wmsLayer, layer.id);
    return wmsLayer;
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Gets the tilesetId for the current playback state and handles fetching config if not available.
   *
   * @returns The tilesetId or undefined if not available (triggers async fetch)
   */
  private getTilesetId(
    layerId: string,
    layer: TileLayer,
    timeIndex: number | undefined,
  ): string | undefined {
    const config = this.layerConfigService.getConfig(layerId) as
      | RadarTileLayerConfig
      | GoesTileLayerConfig
      | undefined;

    if (!config) {
      // Trigger async config load - this will update the config map
      const categoryName = layer.category === LayerCategory.RADAR ? 'Radar' : 'GOES';
      this.layerConfigService.fetchLayerConfig(layer as Layer).subscribe({
        next: () => console.debug(`✅ [LayerRenderer] ${categoryName} config loaded for`, layerId),
        error: (err) =>
          console.error(`❌ [LayerRenderer] Failed to load ${categoryName} config:`, err),
      });
      return undefined;
    }

    // Get the tileset ID for the current time index
    const tilesets = config.availableTilesets;
    if (!tilesets || tilesets.length === 0) {
      return undefined;
    }

    // If timeIndex is undefined, use the latest period
    const resolvedTimeIndex = timeIndex ?? tilesets.length - 1;

    if (resolvedTimeIndex >= tilesets.length) {
      return undefined;
    }

    return tilesets[resolvedTimeIndex];
  }

  /**
   * Builds a Leaflet TileLayer with common options and layer-specific configuration.
   *
   * @param tileUrl - The URL template for tiles
   * @param layer - The layer configuration
   * @param opacity - Optional opacity override (0-1)
   * @param extraOptions - Additional Leaflet tile layer options
   * @returns Configured Leaflet TileLayer
   */
  private buildTileLayer(
    tileUrl: string,
    layer: TileLayer,
    opacity?: number,
    extraOptions?: L.TileLayerOptions,
  ): L.TileLayer {
    const baseOptions = this.createBaseTileLayerOptions(opacity);
    return L.tileLayer(tileUrl, {
      ...baseOptions,
      minNativeZoom: layer.minNativeZoom,
      maxNativeZoom: layer.maxNativeZoom,
      bounds: layer.boundingBox as L.LatLngBoundsExpression | undefined,
      tms: layer.tms ?? false,
      ...extraOptions,
    });
  }

  /**
   * Creates base tile layer options using global map configuration.
   * These options are common to all tile layers.
   */
  private createBaseTileLayerOptions(opacity?: number): L.TileLayerOptions {
    return {
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      noWrap: true,
      opacity: opacity,
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
