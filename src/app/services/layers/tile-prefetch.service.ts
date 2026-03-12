import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { LayerControlService } from './layer-control.service';
import { LayerConfigService } from './layer-config.service';
import {
  LayerControls,
  RadarLayerControls,
  TileLayerControls,
} from '../../models/layers/controls.models';
import { Layer, LayerCategory, LayerType } from '../../models/layers/models';
import {
  LayerConfig,
  GoesTileLayerConfig,
  RadarTileLayerConfig,
} from '../../models/layers/config.models';
import { buildTileUrl } from '../../config/backend.config';
import { MAP_CONFIG } from '../../config';
import { calcTileRange, TileRange } from '../../utils/tile-math';

const MAX_CONCURRENT = 100;
const MAX_TILES_PER_LAYER = 3000;

/**
 * Service responsible for prefetching tiles for the current animation window.
 *
 * This service:
 * - Reacts to changes in active layers, layer configurations, and zoom level
 * - Builds tile URLs for the last N frames (per layer's lastImagesCount) at the current zoom
 * - Loads tiles via the browser's Image API to populate the HTTP cache before they are needed
 * - Limits concurrency to avoid overwhelming the network
 * - Deduplicates requests so that periodic config refreshes do not re-fetch already-cached tiles
 * - Clears the queue and in-flight tracking when the zoom changes (tile coordinates change)
 * - Rebuilds the queue from scratch on each schedule so that removed layers' pending URLs are
 *   discarded immediately; in-flight Image loads (already started) complete normally
 *
 * Frames are enqueued by proximity to the current playback position (forward-biased), so the
 * frames the user will see next are cached first. Layers with more than 300 tiles at the clamped zoom are skipped to prevent
 * hammering the server at high zoom levels with large bounding boxes.
 */
@Injectable({ providedIn: 'root' })
export class TilePrefetchService {
  private readonly controlService = inject(LayerControlService);
  private readonly configService = inject(LayerConfigService);

  /** Current map zoom level, updated externally via setZoom(). */
  readonly zoom = signal<number>(MAP_CONFIG.initialZoom);

  private readonly queue: string[] = [];
  private activeCount = 0;

  /**
   * Tracks all URLs that have been enqueued or are currently loading.
   * Prevents duplicate requests across effect re-triggers (e.g. config polling every 10s).
   * On error, the URL is removed so it can be retried on the next schedulePrefetch call.
   */
  private readonly inFlight = new Set<string>();

  constructor() {
    effect(() => {
      const activeLayers = this.controlService.activeLayers();
      const configs = this.configService.configs();
      const zoom = this.zoom();
      untracked(() => this.schedulePrefetch(activeLayers, configs, zoom));
    });
  }

  /**
   * Updates the current zoom level and clears the prefetch queue.
   * Should be called whenever the map zoom changes so stale tile coordinates are discarded.
   * @param zoom - New integer zoom level
   */
  setZoom(zoom: number): void {
    this.zoom.set(zoom);
    this.queue.length = 0;
    this.inFlight.clear();
  }

  /**
   * Prefetches tiles for a specific time range across multiple layers (for sync playback).
   * This method is called by SyncPlaybackService to preload tiles before they're needed.
   *
   * @param layerIds - IDs of layers to prefetch
   * @param timeRange - Min and max timestamps defining the range to prefetch
   */
  prefetchSyncRange(layerIds: string[], timeRange: { min: Date; max: Date }): void {
    const configs = this.configService.configs();
    const zoom = this.zoom();
    const activeLayers = this.controlService.activeLayers();

    for (const layerId of layerIds) {
      // Find the layer and its controls
      const activeLayer = activeLayers.find((item) => item.layer.id === layerId);
      if (!activeLayer) continue;

      const { layer, controls } = activeLayer;
      if (layer.type !== LayerType.TILE || !layer.boundingBox) continue;

      const config = configs.get(layer.id);
      if (!config || config.type !== LayerType.TILE) continue;

      const tileConfig = config as GoesTileLayerConfig | RadarTileLayerConfig;
      if (!tileConfig.availableTilesets || tileConfig.availableTilesets.length === 0) continue;

      // Filter tilesets to only those within the time range
      const tilesetsInRange = this.filterTilesetsByTimeRange(
        tileConfig.availableTilesets,
        layer.category,
        timeRange,
      );

      if (tilesetsInRange.length === 0) continue;

      // Clamp zoom to native zoom range
      const clampedZoom = Math.min(Math.max(zoom, layer.minNativeZoom), layer.maxNativeZoom);
      const tileRange = calcTileRange(layer.boundingBox, clampedZoom);

      // Build and enqueue URLs for all tilesets in range
      if (layer.category === LayerCategory.GOES_19) {
        for (const tilesetId of tilesetsInRange) {
          const urls = this.buildUrls(`${layer.id}/${tilesetId}`, clampedZoom, tileRange);
          if (urls.length > MAX_TILES_PER_LAYER) continue;
          this.enqueue(urls);
        }
      } else if (layer.category === LayerCategory.RADAR) {
        const radarControls = controls as RadarLayerControls;
        for (const elevationId of radarControls.elevation.selectedElevationIds) {
          for (const tilesetId of tilesetsInRange) {
            const urls = this.buildUrls(
              `${layer.id}/${elevationId}/${tilesetId}`,
              clampedZoom,
              tileRange,
              true,
            );
            if (urls.length > MAX_TILES_PER_LAYER) continue;
            this.enqueue(urls);
          }
        }
      }
    }

    this.drain();
  }

  /**
   * Filters tilesets to only include those within a specific time range.
   * Parses timestamps according to layer category.
   */
  private filterTilesetsByTimeRange(
    tilesets: string[],
    category: LayerCategory,
    timeRange: { min: Date; max: Date },
  ): string[] {
    return tilesets.filter((tileset) => {
      const timestamp = this.parseTilesetTimestamp(tileset, category);
      if (!timestamp) return false;
      return timestamp >= timeRange.min && timestamp <= timeRange.max;
    });
  }

  /**
   * Parses a tileset ID to a Date based on layer category.
   */
  private parseTilesetTimestamp(tileset: string, category: LayerCategory): Date | null {
    switch (category) {
      case LayerCategory.GOES_19:
        return this.parseGoesTimestamp(tileset);
      case LayerCategory.RADAR:
        return this.parseRadarTimestamp(tileset);
      default:
        return null;
    }
  }

  /**
   * Parses GOES timestamp in Julian format YYYYJJJHHMMSSS
   */
  private parseGoesTimestamp(tileset: string): Date | null {
    if (tileset.length < 11) return null;

    const year = parseInt(tileset.substring(0, 4));
    const dayOfYear = parseInt(tileset.substring(4, 7));
    const hour = parseInt(tileset.substring(7, 9));
    const minute = parseInt(tileset.substring(9, 11));

    const date = new Date(year, 0);
    date.setDate(dayOfYear);
    date.setHours(hour, minute, 0, 0);

    return date;
  }

  /**
   * Parses Radar timestamp in ISO-like format YYYYMMDDTHHMMSSZ
   */
  private parseRadarTimestamp(tileset: string): Date | null {
    if (tileset.length < 15) return null;

    const year = parseInt(tileset.substring(0, 4));
    const month = parseInt(tileset.substring(4, 6)) - 1;
    const day = parseInt(tileset.substring(6, 8));
    const hour = parseInt(tileset.substring(9, 11));
    const minute = parseInt(tileset.substring(11, 13));
    const second = parseInt(tileset.substring(13, 15));

    return new Date(year, month, day, hour, minute, second);
  }

  // ============================================================================
  // Private Methods - Scheduling
  // ============================================================================

  /**
   * Builds and enqueues tile URLs for all active TILE layers across their animation window.
   * Skips WMS layers, layers without a bounding box, and layers exceeding the tile count guard.
   *
   * The queue is rebuilt from scratch on every call so that URLs added by layers no longer active
   * are discarded before they are started. In-flight Image loads (up to MAX_CONCURRENT) are
   * unaffected — they cannot be cancelled and will complete normally.
   */
  private schedulePrefetch(
    activeLayers: { layer: Layer; controls: LayerControls }[],
    configs: Map<string, LayerConfig>,
    zoom: number,
  ): void {
    // Rebuild queue from scratch so removed layers' pending URLs are discarded.
    // In-flight Image loads (already started) complete normally and are unaffected.
    this.queue.length = 0;

    for (const { layer, controls } of activeLayers) {
      if (layer.type !== LayerType.TILE || !layer.boundingBox) continue;

      const config = configs.get(layer.id);
      if (!config || config.type !== LayerType.TILE) continue;

      const tileConfig = config as GoesTileLayerConfig | RadarTileLayerConfig;
      if (!tileConfig.availableTilesets || tileConfig.availableTilesets.length === 0) continue;

      const tileControls = controls as TileLayerControls;
      const lastImagesCount = tileControls.playback.lastImagesCount;

      // Sort frames by proximity to current playback position, forward-biased (ahead first)
      const currentTimeIndex =
        tileControls.playback.timeIndex ?? tileConfig.availableTilesets.length - 1;
      const windowStart = tileConfig.availableTilesets.length - lastImagesCount;
      const posInWindow = Math.max(0, currentTimeIndex - windowStart);
      const frameWindow = [...tileConfig.availableTilesets].slice(-lastImagesCount);
      const ordered = Array.from({ length: frameWindow.length }, (_, i) => i)
        .sort((a, b) => {
          const da = a > posInWindow ? a - posInWindow : (posInWindow - a) * 1.1;
          const db = b > posInWindow ? b - posInWindow : (posInWindow - b) * 1.1;
          return da - db;
        })
        .map((i) => frameWindow[i]);

      // Clamp zoom to native zoom range to avoid requesting non-existent tiles
      const clampedZoom = Math.min(Math.max(zoom, layer.minNativeZoom), layer.maxNativeZoom);
      const tileRange = calcTileRange(layer.boundingBox, clampedZoom);

      if (layer.category === LayerCategory.GOES_19) {
        for (const tilesetId of ordered) {
          const urls = this.buildUrls(`${layer.id}/${tilesetId}`, clampedZoom, tileRange);
          if (urls.length > MAX_TILES_PER_LAYER) continue;
          this.enqueue(urls);
        }
      } else if (layer.category === LayerCategory.RADAR) {
        const radarControls = controls as RadarLayerControls;
        for (const elevationId of radarControls.elevation.selectedElevationIds) {
          for (const tilesetId of ordered) {
            const urls = this.buildUrls(
              `${layer.id}/${elevationId}/${tilesetId}`,
              clampedZoom,
              tileRange,
              true,
            );
            if (urls.length > MAX_TILES_PER_LAYER) continue;
            this.enqueue(urls);
          }
        }
      }
    }

    this.drain();
  }

  /**
   * Builds the full list of tile URLs for a given tileset path, zoom level, and tile range.
   * @param pathToTileset - Tileset path passed to buildTileUrl (e.g. "goes-19/abi/ch-2/202501010000")
   * @param zoom - Zoom level to use in the URL
   * @param tileRange - Inclusive tile coordinate range to iterate
   * @param tms - When true, flips the Y axis for TMS tile scheme (used by radar layers)
   * @returns Array of fully-resolved tile URLs
   */
  private buildUrls(
    pathToTileset: string,
    zoom: number,
    tileRange: TileRange,
    tms = false,
  ): string[] {
    const template = buildTileUrl(pathToTileset);
    const urls: string[] = [];
    const maxY = Math.pow(2, zoom) - 1;

    for (let x = tileRange.xMin; x <= tileRange.xMax; x++) {
      for (let y = tileRange.yMin; y <= tileRange.yMax; y++) {
        const tileY = tms ? maxY - y : y;
        const url = template
          .replace('{z}', String(zoom))
          .replace('{x}', String(x))
          .replace('{y}', String(tileY));
        urls.push(url);
      }
    }

    return urls;
  }

  /**
   * Adds URLs to the queue, skipping any already tracked in inFlight.
   * @param urls - Tile URLs to enqueue
   */
  private enqueue(urls: string[]): void {
    for (const url of urls) {
      if (!this.inFlight.has(url)) {
        this.inFlight.add(url);
        this.queue.push(url);
      }
    }
  }

  // ============================================================================
  // Private Methods - Loading
  // ============================================================================

  /**
   * Concurrency-limited tile loader. Processes up to MAX_CONCURRENT tiles at a time.
   * Each completed load (success or error) triggers the next item in the queue.
   * On error, the URL is removed from inFlight so it can be retried on the next schedule.
   */
  private drain(): void {
    while (this.activeCount < MAX_CONCURRENT && this.queue.length > 0) {
      const url = this.queue.shift()!;
      this.activeCount++;
      const img = new Image();
      img.onload = () => {
        this.activeCount--;
        this.drain();
      };
      img.onerror = () => {
        this.activeCount--;
        this.inFlight.delete(url);
        this.drain();
      };
      img.src = url;
    }
  }
}
