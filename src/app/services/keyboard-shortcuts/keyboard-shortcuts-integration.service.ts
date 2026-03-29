import { Injectable, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';
import { SHORTCUT_IDS } from '../../config/keyboard-shortcuts.config';
import { LayerControlService } from '../layers/layer-control.service';
import { MapInfoService } from '../layers/map-info.service';
import { ScaleToolsService } from '../layers/scale-tools.service';
import { SyncPlaybackService } from '../layers/sync-playback.service';
import { PolygonDrawingService, DrawingMode } from '../polygons/polygon-drawing.service';
import { MAP_CONFIG } from '../../config';

/**
 * Integration service that connects keyboard shortcuts to application services.
 *
 * This service is responsible for registering all the handlers that execute
 * the actual application logic when shortcuts are triggered.
 *
 * Must be initialized with a reference to the main menu for panel navigation.
 */
@Injectable({
  providedIn: 'root',
})
export class KeyboardShortcutsIntegrationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly shortcutsService = inject(KeyboardShortcutsService);
  private readonly layerControlService = inject(LayerControlService);
  private readonly mapInfoService = inject(MapInfoService);
  private readonly scaleToolsService = inject(ScaleToolsService);
  private readonly syncPlaybackService = inject(SyncPlaybackService);
  private readonly polygonDrawingService = inject(PolygonDrawingService);
  private readonly destroyRef = inject(DestroyRef);

  private unsubscribeHandlers: (() => void) | null = null;
  private initialized = false;

  /**
   * Initialize the integration service.
   * Should be called once when the app is ready.
   */
  initialize(): void {
    if (!isPlatformBrowser(this.platformId) || this.initialized) {
      return;
    }

    this.registerAllHandlers();
    this.initialized = true;

    this.destroyRef.onDestroy(() => {
      this.unsubscribeHandlers?.();
    });
  }

  /**
   * Registers all shortcut handlers
   */
  private registerAllHandlers(): void {
    this.unsubscribeHandlers = this.shortcutsService.registerHandlers({
      // Playback controls
      [SHORTCUT_IDS.TOGGLE_PLAYBACK]: () => this.togglePlayback(),
      [SHORTCUT_IDS.TOGGLE_SYNC_PLAYBACK]: () => this.toggleSyncPlayback(),
      [SHORTCUT_IDS.NEXT_FRAME]: () => this.nextFrame(),
      [SHORTCUT_IDS.PREV_FRAME]: () => this.prevFrame(),
      [SHORTCUT_IDS.SPEED_UP]: () => this.speedUp(),
      [SHORTCUT_IDS.SPEED_DOWN]: () => this.speedDown(),

      // Layer toggles
      [SHORTCUT_IDS.TOGGLE_FIRST_LAYER]: () => this.toggleLayerByIndex(0),
      [SHORTCUT_IDS.TOGGLE_SECOND_LAYER]: () => this.toggleLayerByIndex(1),
      [SHORTCUT_IDS.TOGGLE_THIRD_LAYER]: () => this.toggleLayerByIndex(2),
      [SHORTCUT_IDS.TOGGLE_ALL_SCALES]: () => this.toggleAllScales(),

      // Drawing mode
      [SHORTCUT_IDS.START_DRAW_POLYGON]: () => this.toggleDrawMode(DrawingMode.DRAW),
      [SHORTCUT_IDS.CANCEL_DRAWING]: () => this.cancelDrawing(),
      [SHORTCUT_IDS.START_EDIT_MODE]: () => this.toggleDrawMode(DrawingMode.EDIT),
      [SHORTCUT_IDS.START_DELETE_MODE]: () => this.toggleDrawMode(DrawingMode.DELETE),

      // Map tools
      [SHORTCUT_IDS.TOGGLE_COORDINATES]: () => this.toggleCoordinates(),
      [SHORTCUT_IDS.TOGGLE_SCALE_BAR]: () => this.toggleScaleBar(),

      // Map navigation
      [SHORTCUT_IDS.ZOOM_IN]: () => this.mapInfoService.zoomIn(),
      [SHORTCUT_IDS.ZOOM_OUT]: () => this.mapInfoService.zoomOut(),
      [SHORTCUT_IDS.RESET_VIEW]: () => this.resetView(),
    });
  }

  // ============================================================================
  // Playback handlers
  // ============================================================================

  private togglePlayback(): void {
    // Get the first active tile layer with playback capability
    const activeLayers = this.layerControlService.activeLayers();
    const playableLayer = activeLayers.find(
      ({ controls }) => controls.type === 'tile' && controls.playback,
    );

    if (playableLayer) {
      this.layerControlService.togglePlayback(playableLayer.layer.id);
    }
  }

  private toggleSyncPlayback(): void {
    const syncState = this.syncPlaybackService.syncState();
    if (syncState.selectedLayerIds.length > 0) {
      this.syncPlaybackService.togglePlayback();
    }
  }

  private nextFrame(): void {
    const syncState = this.syncPlaybackService.syncState();

    // If sync playback has selected layers, use it
    if (syncState.selectedLayerIds.length > 0) {
      const currentFrame = syncState.frameIndex;
      this.syncPlaybackService.setFrameIndex(currentFrame + 1);
      return;
    }

    // Otherwise, advance the first active tile layer
    const activeLayers = this.layerControlService.activeLayers();
    const firstTileLayer = activeLayers.find(
      ({ controls }) => controls.type === 'tile' && controls.playback,
    );

    if (firstTileLayer) {
      const controls = firstTileLayer.controls as { playback: { timeIndex?: number } };
      const currentIndex = controls.playback.timeIndex ?? 0;
      this.layerControlService.setTimeIndex(firstTileLayer.layer.id, currentIndex + 1);
    }
  }

  private prevFrame(): void {
    const syncState = this.syncPlaybackService.syncState();

    if (syncState.selectedLayerIds.length > 0) {
      const currentFrame = syncState.frameIndex;
      this.syncPlaybackService.setFrameIndex(Math.max(0, currentFrame - 1));
      return;
    }

    const activeLayers = this.layerControlService.activeLayers();
    const firstTileLayer = activeLayers.find(
      ({ controls }) => controls.type === 'tile' && controls.playback,
    );

    if (firstTileLayer) {
      const controls = firstTileLayer.controls as { playback: { timeIndex?: number } };
      const currentIndex = controls.playback.timeIndex ?? 0;
      this.layerControlService.setTimeIndex(firstTileLayer.layer.id, Math.max(0, currentIndex - 1));
    }
  }

  private speedUp(): void {
    const syncState = this.syncPlaybackService.syncState();

    if (syncState.selectedLayerIds.length > 0 && syncState.isPlaying) {
      this.syncPlaybackService.setSpeed(syncState.speed + 0.2);
      return;
    }

    const activeLayers = this.layerControlService.activeLayers();
    const playingLayer = activeLayers.find(({ layer }) =>
      this.layerControlService.isPlaying(layer.id),
    );

    if (playingLayer) {
      const controls = playingLayer.controls as { playback: { speed: number } };
      const newSpeed = Math.min(10, controls.playback.speed + 0.2);
      this.layerControlService.setPlaySpeed(playingLayer.layer.id, newSpeed);
    }
  }

  private speedDown(): void {
    const syncState = this.syncPlaybackService.syncState();

    if (syncState.selectedLayerIds.length > 0 && syncState.isPlaying) {
      this.syncPlaybackService.setSpeed(Math.max(0.4, syncState.speed - 0.2));
      return;
    }

    const activeLayers = this.layerControlService.activeLayers();
    const playingLayer = activeLayers.find(({ layer }) =>
      this.layerControlService.isPlaying(layer.id),
    );

    if (playingLayer) {
      const controls = playingLayer.controls as { playback: { speed: number } };
      const newSpeed = Math.max(0.4, controls.playback.speed - 0.2);
      this.layerControlService.setPlaySpeed(playingLayer.layer.id, newSpeed);
    }
  }

  // ============================================================================
  // Layer handlers
  // ============================================================================

  private toggleLayerByIndex(index: number): void {
    const activeLayers = this.layerControlService.activeLayers();
    if (index < activeLayers.length) {
      const layer = activeLayers[index];
      this.layerControlService.toggleLayer(layer.layer.id);
    }
  }

  private toggleAllScales(): void {
    const selectedLayers = this.scaleToolsService.selectedLayerIdsOrdered();
    const activeLayers = this.layerControlService.activeLayers();

    if (selectedLayers.length === activeLayers.length) {
      // All selected, deselect all
      selectedLayers.forEach((id) => this.scaleToolsService.toggleLayerSelection(id));
    } else {
      // Select all active layers
      activeLayers.forEach(({ layer }) => {
        if (!selectedLayers.includes(layer.id)) {
          this.scaleToolsService.toggleLayerSelection(layer.id);
        }
      });
    }
  }

  // ============================================================================
  // Drawing handlers
  // ============================================================================

  private toggleDrawMode(mode: DrawingMode): void {
    this.polygonDrawingService.toggleDrawMode(mode);
  }

  private cancelDrawing(): void {
    if (this.polygonDrawingService.drawingMode() !== DrawingMode.NONE) {
      this.polygonDrawingService.stopDrawing();
    }
  }

  // ============================================================================
  // Map tools handlers
  // ============================================================================

  private toggleCoordinates(): void {
    this.mapInfoService.toggleCoordinates(!this.mapInfoService.showCoordinates());
  }

  private toggleScaleBar(): void {
    this.mapInfoService.toggleScale(!this.mapInfoService.showScale());
  }

  private resetView(): void {
    // This would need access to the map instance, which MapInfoService has
    // For now we'll just set zoom to initial value
    const currentZoom = this.mapInfoService.currentZoom();
    const diff = MAP_CONFIG.initialZoom - currentZoom;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        this.mapInfoService.zoomIn();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        this.mapInfoService.zoomOut();
      }
    }
  }
}
