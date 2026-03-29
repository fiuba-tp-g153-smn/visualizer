import { Component, computed, inject } from '@angular/core';
import { PointQueryViewerService } from '../../services/layers/point-query-tools.service';
import { ScaleToolsService } from '../../services/layers/scale-tools.service';
import { MapInfoService } from '../../services/layers/map-info.service';
import { KeyboardShortcutsService } from '../../services/keyboard-shortcuts/keyboard-shortcuts.service';
import { SHORTCUT_IDS } from '../../config/keyboard-shortcuts.config';
import { formatKeyCombination } from '../../models';
import {
  DrawingMode,
  PolygonDrawingService,
} from '../../services/polygons/polygon-drawing.service';
import { PolygonEditAction } from './polygon-edit-controls/polygon-edit-controls';
import { PolygonContextMenuAction } from '../../models';
import { MapPolygonsService } from '../../services/polygons/map-polygons.service';
import { MapEditControlsComponent } from './edit-controls/edit-controls';
import { MainMenuComponent } from './main-menu/main-menu';
import { MapPolygonContextMenuComponent } from '../floating/polygon-context-menu/polygon-context-menu';
import { MapPointValuesComponent } from './point-values/point-values';
import { MapScaleToolsComponent } from './scale-tools/scale-tools';
import { MapZoomControlsComponent } from './zoom-controls/zoom-controls';
import { MapAttributionComponent } from './map-attribution/map-attribution';
import { MapScaleComponent } from './map-scale/map-scale';
import { MapCoordinatesComponent } from './map-coordinates/map-coordinates';

@Component({
  selector: 'app-map-overlay',
  standalone: true,
  imports: [
    MainMenuComponent,
    MapEditControlsComponent,
    MapPolygonContextMenuComponent,
    MapPointValuesComponent,
    MapScaleToolsComponent,
    MapZoomControlsComponent,
    MapAttributionComponent,
    MapScaleComponent,
    MapCoordinatesComponent,
  ],
  templateUrl: './map-overlay.html',
  styleUrl: './map-overlay.scss',
})
export class MapOverlayComponent {
  private pointQueryViewerService = inject(PointQueryViewerService);
  private scaleToolsService = inject(ScaleToolsService);
  private polygonDrawingService = inject(PolygonDrawingService);
  private polygonsService = inject(MapPolygonsService);
  private mapInfoService = inject(MapInfoService);
  private shortcutsService = inject(KeyboardShortcutsService);

  readonly drawingMode = this.polygonDrawingService.drawingMode;
  readonly editingPolygonId = this.polygonDrawingService.editingPolygonId;
  readonly isEditingPolygon = computed(
    () => this.drawingMode() === DrawingMode.EDIT && !!this.editingPolygonId(),
  );

  readonly floatingViewerEntries = this.pointQueryViewerService.floatingViewerEntries;
  readonly isViewerEnabled = this.pointQueryViewerService.isViewerEnabled;
  readonly scaleToolEntries = this.scaleToolsService.scaleEntries;
  readonly isScaleToolsEnabled = this.scaleToolsService.shouldShowScales;

  // Map info signals
  readonly showZoom = this.mapInfoService.showZoom;
  readonly currentZoom = this.mapInfoService.currentZoom;
  readonly canZoomIn = this.mapInfoService.canZoomIn;
  readonly canZoomOut = this.mapInfoService.canZoomOut;

  readonly showScale = this.mapInfoService.showScale;
  readonly scaleInfo = this.mapInfoService.scaleInfo;

  readonly showCoordinates = this.mapInfoService.showCoordinates;
  readonly mouseLatitude = this.mapInfoService.mouseLatitude;
  readonly mouseLongitude = this.mapInfoService.mouseLongitude;

  readonly showAttribution = this.mapInfoService.showAttribution;

  // Zoom tooltips with keyboard shortcuts
  readonly zoomInTooltip = computed(() => this.getShortcutTooltip('Acercar', SHORTCUT_IDS.ZOOM_IN));
  readonly zoomOutTooltip = computed(() =>
    this.getShortcutTooltip('Alejar', SHORTCUT_IDS.ZOOM_OUT),
  );

  // Computed: any bottom control is visible
  readonly hasBottomControls = computed(
    () => this.showZoom() || this.showScale() || this.showCoordinates() || this.showAttribution(),
  );

  // Computed: any right column control is visible (scale/coords/attribution)
  readonly hasInfoControls = computed(
    () => this.showScale() || this.showCoordinates() || this.showAttribution(),
  );

  readonly contextMenuState = this.polygonsService.contextMenuState;

  /**
   * Gets a tooltip with keyboard shortcut hint
   */
  private getShortcutTooltip(baseText: string, shortcutId: string): string {
    const shortcut = this.shortcutsService.getShortcutById(shortcutId);
    if (shortcut && this.shortcutsService.isShortcutEnabled(shortcut.id)) {
      return `${baseText} (${formatKeyCombination(shortcut.keyCombination)})`;
    }
    return baseText;
  }

  closeFloatingViewer(layerId: string): void {
    this.pointQueryViewerService.removeSourceSelection(layerId);
  }

  zoomIn(): void {
    this.mapInfoService.zoomIn();
  }

  zoomOut(): void {
    this.mapInfoService.zoomOut();
  }

  closeScale(): void {
    this.mapInfoService.toggleScale(false);
  }

  closeCoordinates(): void {
    this.mapInfoService.toggleCoordinates(false);
  }

  closeAttribution(): void {
    this.mapInfoService.toggleAttribution(false);
  }

  closeScaleTool(layerId: string): void {
    this.scaleToolsService.toggleLayerSelection(layerId);
  }

  handleEditAction(action: PolygonEditAction): void {
    const editingId = this.editingPolygonId();

    if (action.type === 'save') {
      this.polygonsService.savePolygonEdit(editingId);
    } else if (action.type === 'cancel') {
      this.polygonsService.cancelPolygonEdit(editingId);
    }
  }

  closeContextMenu(): void {
    this.polygonsService.closeContextMenu();
  }

  handleContextMenuAction(action: PolygonContextMenuAction): void {
    this.polygonsService.handleContextMenuAction(action);
  }
}
