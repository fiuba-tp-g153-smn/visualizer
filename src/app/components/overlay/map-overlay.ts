import { Component, computed, inject } from '@angular/core';
import {
  POINT_QUERY_PANEL_MODES,
  PointQueryViewerService,
} from '../../services/tools/point-query-viewer.service';
import { ScaleToolsService } from '../../services/tools/scale-tools.service';
import { MapInfoService } from '../../services/layers/map-info.service';
import {
  DrawingMode,
  PolygonDrawingService,
} from '../../services/polygons/polygon-drawing.service';
import { PolygonEditAction } from '../floating/polygon-edit-dock/polygon-edit-dock';
import { EmittedAlertContextMenuAction, PolygonContextMenuAction } from '../../models';
import { MapPolygonsService } from '../../services/polygons/map-polygons.service';
import { ActiveAlertsMapService } from '../../services/active-alerts/active-alerts-map.service';
import { PolygonEditDockComponent } from '../floating/polygon-edit-dock/polygon-edit-dock';
import { MainMenuComponent } from './main-menu/main-menu';
import { SidebarButtonsComponent } from './sidebar-buttons/sidebar-buttons';
import { MapPolygonContextMenuComponent } from '../floating/polygon-context-menu/polygon-context-menu';
import { SearchResultContextMenuComponent } from '../floating/search-result-context-menu/search-result-context-menu';
import { EmittedAlertContextMenuComponent } from '../floating/emitted-alert-context-menu/emitted-alert-context-menu';
import { MapPointValuesComponent, PointValuesLayoutMode } from './point-values/point-values';
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
    SidebarButtonsComponent,
    PolygonEditDockComponent,
    MapPolygonContextMenuComponent,
    SearchResultContextMenuComponent,
    EmittedAlertContextMenuComponent,
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
  readonly PointValuesLayoutMode = PointValuesLayoutMode;

  private pointQueryViewerService = inject(PointQueryViewerService);
  private scaleToolsService = inject(ScaleToolsService);
  private polygonDrawingService = inject(PolygonDrawingService);
  private polygonsService = inject(MapPolygonsService);
  private activeAlertsMapService = inject(ActiveAlertsMapService);
  private mapInfoService = inject(MapInfoService);

  readonly drawingMode = this.polygonDrawingService.drawingMode;
  readonly editingPolygonId = this.polygonDrawingService.editingPolygonId;
  readonly isEditingPolygon = computed(
    () => this.drawingMode() === DrawingMode.EDIT && !!this.editingPolygonId(),
  );

  readonly floatingViewerEntries = this.pointQueryViewerService.floatingViewerEntries;
  readonly isViewerEnabled = this.pointQueryViewerService.enabled;
  readonly isViewerMarkerEnabled = this.pointQueryViewerService.showMarker;
  readonly viewerPanelMode = this.pointQueryViewerService.panelMode;
  readonly scaleToolEntries = this.scaleToolsService.scaleEntries;
  readonly isScaleToolsEnabled = this.scaleToolsService.shouldShowScales;
  readonly queryMarkerScreenPosition = this.mapInfoService.queryMarkerScreenPosition;
  readonly isMapZooming = this.mapInfoService.isZooming;

  readonly isFixedViewerVisible = computed(
    () => this.isViewerEnabled() && this.viewerPanelMode() === POINT_QUERY_PANEL_MODES.FIXED,
  );

  readonly nearMarkerPanelPosition = computed(() => {
    if (
      !this.isViewerEnabled() ||
      !this.isViewerMarkerEnabled() ||
      this.isMapZooming() ||
      this.viewerPanelMode() !== POINT_QUERY_PANEL_MODES.NEAR_MARKER ||
      this.floatingViewerEntries().length === 0
    ) {
      return null;
    }

    const markerPosition = this.queryMarkerScreenPosition();
    if (!markerPosition) {
      return null;
    }

    return {
      x: markerPosition.x + 16,
      y: markerPosition.y - 12,
    };
  });

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

  readonly hasBottomControls = computed(
    () => this.showZoom() || this.showScale() || this.showCoordinates() || this.showAttribution(),
  );

  readonly hasInfoControls = computed(
    () => this.showScale() || this.showCoordinates() || this.showAttribution(),
  );

  readonly contextMenuState = this.polygonsService.contextMenuState;
  readonly emittedAlertContextMenuState = this.activeAlertsMapService.contextMenuState;
  readonly searchResultContextMenuState = this.mapInfoService.searchResultContextMenu;

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

  closeEmittedAlertContextMenu(): void {
    this.activeAlertsMapService.closeContextMenu();
  }

  handleEmittedAlertContextMenuAction(action: EmittedAlertContextMenuAction): void {
    this.activeAlertsMapService.handleContextMenuAction(action);
  }

  closeSearchResultContextMenu(): void {
    this.mapInfoService.closeSearchResultContextMenu();
  }

  clearSearchResult(): void {
    this.mapInfoService.clearSearchResult();
  }
}
