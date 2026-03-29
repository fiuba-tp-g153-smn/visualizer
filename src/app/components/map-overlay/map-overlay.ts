import { Component, computed, inject } from '@angular/core';
import { PointQueryViewerService } from '../../services/layers/point-query-tools.service';
import { ScaleToolsService } from '../../services/layers/scale-tools.service';
import { MapInfoService } from '../../services/layers/map-info.service';
import {
  DrawingMode,
  PolygonDrawingService,
} from '../../services/polygons/polygon-drawing.service';
import { PolygonEditAction } from './polygon-edit-controls/polygon-edit-controls';
import { PolygonContextMenuAction } from '../../models';
import { MapPolygonsService } from '../../services/polygons/map-polygons.service';
import { MapEditControlsComponent } from './edit-controls/edit-controls';
import { MainMenuComponent } from './main-menu/main-menu';
import { MapPolygonContextMenuComponent } from './polygon-context-menu/polygon-context-menu';
import { MapPointValuesComponent } from './point-values/point-values';
import { MapScaleToolsComponent } from './scale-tools/scale-tools';
import { MapZoomControlsComponent } from './zoom-controls/zoom-controls';
import { MapAttributionComponent } from './map-attribution/map-attribution';

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

  readonly drawingMode = this.polygonDrawingService.drawingMode;
  readonly editingPolygonId = this.polygonDrawingService.editingPolygonId;
  readonly isEditingPolygon = computed(
    () => this.drawingMode() === DrawingMode.EDIT && !!this.editingPolygonId(),
  );

  readonly floatingViewerEntries = this.pointQueryViewerService.floatingViewerEntries;
  readonly isViewerEnabled = this.pointQueryViewerService.isViewerEnabled;
  readonly scaleToolEntries = this.scaleToolsService.scaleEntries;
  readonly isScaleToolsEnabled = this.scaleToolsService.shouldShowScales;
  readonly isAppZoomVisible = this.mapInfoService.showZoom;
  readonly currentZoom = this.mapInfoService.currentZoom;
  readonly canZoomIn = this.mapInfoService.canZoomIn;
  readonly canZoomOut = this.mapInfoService.canZoomOut;
  readonly contextMenuState = this.polygonsService.contextMenuState;

  readonly closeFloatingViewer = (layerId: string): void => {
    this.pointQueryViewerService.removeSourceSelection(layerId);
  };

  closeScale(layerId: string): void {
    this.scaleToolsService.toggleLayerSelection(layerId);
  }

  zoomIn(): void {
    this.mapInfoService.zoomIn();
  }

  zoomOut(): void {
    this.mapInfoService.zoomOut();
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
