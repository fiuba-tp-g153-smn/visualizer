/// <reference types="leaflet-editable" />
import { Injectable, inject, effect, signal, computed } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import * as L from 'leaflet';
import 'leaflet-editable';
import { PolygonService } from './polygon.service';
import { AlertEmissionService } from './alert-emission.service';
import { PolygonDrawingService, DrawingMode } from './polygon-drawing.service';
import { LatLng, Polygon } from '../../models/geo';
import {
  PolygonContextMenuAction,
  PolygonContextMenuActionType,
} from '../../models/polygon-context-menu-action.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../components/floating/confirm-dialog/confirm-dialog';
import { POLYGON_COLOR } from '../../config/polygon.config';
import {
  LEAFLET_EDITABLE_EVENTS,
  CSS_VARIABLES,
  MAP_PANES,
} from '../../constants/map-polygons.constants';
import { Z_INDEX, EDIT_STYLE, DEPARTMENT_STYLE } from '../../config/map-polygons.config';
import {
  POLYGON_OPTIONS,
  LINE_GUIDE_OPTIONS,
  createDepartmentStyle,
  lightenColor,
} from '../../utils/map-styles.utils';
import { isSimplePolygon } from '../../utils/polygon-validation.utils';
import { ACTION_DELAYS } from '../../config/timing.config';
import { NotificationService } from '../notifications/notification.service';

export interface PolygonContextMenuState {
  x: number;
  y: number;
  polygonId: string;
  polygonVisible: boolean;
  hasDepartments: boolean;
  departmentsVisible: boolean;
  canUndoCut: boolean;
  isLoadingCut: boolean;
  isLoadingDepartments: boolean;
  isLoadingAlerts: boolean;
  exceedsMaxVertices: boolean;
  maxVertices: number;
}

// Extended types for leaflet
declare module 'leaflet' {
  interface PolylineOptions {
    polygonId?: string;
  }
}

@Injectable({
  providedIn: 'root',
})
export class MapPolygonsService {
  private polygonService = inject(PolygonService);
  private alertEmissionService = inject(AlertEmissionService);
  private polygonDrawingService = inject(PolygonDrawingService);
  private dialog = inject(MatDialog);
  private notificationService = inject(NotificationService);

  private map: L.Map | null = null;
  private polygonLayers = new Map<string, L.Polygon>();
  private departmentLayers = new Map<string, L.GeoJSON[]>(); // polygonId -> array of department GeoJSON layers
  private departmentLayersByName = new Map<
    string,
    Map<string, { layer: L.GeoJSON; baseColor: string }>
  >(); // polygonId -> (departmentName -> layer)
  private currentDrawingPolygon: L.Polygon | null = null;
  private originalCoordinates: Array<LatLng> | null = null;
  private currentEditingPolygonId: string | null = null;
  private readonly contextMenuAnchor = signal<{ x: number; y: number; polygonId: string } | null>(
    null,
  );

  // Derived (not a snapshot) so loading flags and disabled states stay live while
  // the menu is open, and the menu auto-closes if the polygon is removed mid-action
  // (e.g. a draft is deleted once its alert finishes emitting).
  readonly contextMenuState = computed<PolygonContextMenuState | null>(() => {
    const anchor = this.contextMenuAnchor();
    if (!anchor) return null;

    const polygon = this.polygonService.getPolygonById(anchor.polygonId);
    if (!polygon) return null;

    return {
      x: anchor.x,
      y: anchor.y,
      polygonId: anchor.polygonId,
      polygonVisible: polygon.visible,
      hasDepartments: !!polygon.departments && polygon.departments.length > 0,
      departmentsVisible: polygon.departmentsVisible || false,
      canUndoCut: !!polygon.originalCoordinates,
      isLoadingCut: this.polygonService.isPolygonBeingCut(anchor.polygonId),
      isLoadingDepartments: this.polygonService.isDepartmentsLoading(anchor.polygonId),
      isLoadingAlerts: this.polygonService.isAlertsLoading(anchor.polygonId),
      exceedsMaxVertices: this.polygonService.exceedsMaxVertices(polygon),
      maxVertices: this.polygonService.maxVertices(),
    };
  });

  constructor() {
    effect(() => {
      const hovered = this.polygonService.hoveredDepartments();
      this.updateDepartmentHighlight(hovered);
    });
  }

  initialize(map: L.Map): void {
    this.map = map;
    // This service is a root singleton but the map is torn down and recreated on
    // every navigation away from and back to the map view. editTools is wired to
    // the previous map instance, so reset the guard to re-create it on the new map.
    this.editToolsReady = false;
    this.initPolygonDrawing();
  }

  private initPolygonDrawing(): void {
    if (!this.map) return;

    this.map.on(LEAFLET_EDITABLE_EVENTS.DRAWING_COMMIT, (e: any) => {
      this.onPolygonCreated(e.layer);
    });

    this.map.on(LEAFLET_EDITABLE_EVENTS.DRAWING_CANCEL, () => {
      this.onPolygonDrawingCancelled();
    });

    this.map.on(LEAFLET_EDITABLE_EVENTS.DRAWING_CLICKED, (e: any) => {
      const layer = e.layer;
      const editor = layer?.editor;
      if (editor && layer.options) {
        editor.options.lineGuideOptions = LINE_GUIDE_OPTIONS;
      }
    });
  }

  /** Guard so editTools is wired up only once. */
  private editToolsReady = false;

  private ensureEditTools(): void {
    if (this.editToolsReady || !this.map) return;
    if (!this.map.editTools) {
      this.map.editTools = new L.Editable(this.map, {});
      (this.map.editTools as any).createVertexIcon = (options: L.DivIconOptions): L.DivIcon => {
        const size = L.Browser.mobile && L.Browser.touch ? 20 : 12;
        return L.divIcon({ ...options, iconSize: [size, size] });
      };
    }
    this.editToolsReady = true;
  }

  handleDrawingModeChange(mode: DrawingMode, editingPolygonId: string | null): void {
    if (!this.map) return;

    if (mode === DrawingMode.DRAW || mode === DrawingMode.EDIT) {
      this.ensureEditTools();
      if (!this.map) return;
    }

    if (this.currentDrawingPolygon) {
      if (this.map.hasLayer(this.currentDrawingPolygon)) {
        this.map.removeLayer(this.currentDrawingPolygon);
      }
      this.map.editTools.stopDrawing();
      this.currentDrawingPolygon = null;
    }

    this.polygonLayers.forEach((layer) => {
      if (layer.disableEdit) {
        layer.disableEdit();
      }
    });

    // If a polygon was being edited and this transition isn't a save/cancel
    // (those clear currentEditingPolygonId before calling stopDrawing), the edit
    // is abandoned: revert to original coordinates and remove the edit style.
    if (this.currentEditingPolygonId) {
      if (this.originalCoordinates) {
        this.recreatePolygonLayer(this.currentEditingPolygonId, this.originalCoordinates);
      } else {
        const abandonedLayer = this.polygonLayers.get(this.currentEditingPolygonId);
        if (abandonedLayer) {
          abandonedLayer.setStyle({ dashArray: '' });
        }
      }
      this.currentEditingPolygonId = null;
      this.originalCoordinates = null;
    }

    switch (mode) {
      case DrawingMode.DRAW:
        this.startDrawingMode();
        break;

      case DrawingMode.EDIT:
        if (editingPolygonId) {
          this.startEditingMode(editingPolygonId);
        }
        break;

      case DrawingMode.DELETE:
        this.map.doubleClickZoom.enable();
        // DELETE is handled via context menu, not as an active drawing mode
        break;

      case DrawingMode.NONE:
        this.stopAllModes();
        break;
    }
  }

  private startDrawingMode(): void {
    if (!this.map) return;

    // Double-click commits the polygon; zoom would fire first without this
    this.map.doubleClickZoom.disable();

    const mapContainer = this.map.getContainer();
    mapContainer.style.setProperty(CSS_VARIABLES.POLYGON_COLOR, POLYGON_COLOR);

    const editTools = (this.map as any).editTools;
    if (editTools) {
      editTools.options = editTools.options || {};
      editTools.options.lineGuideOptions = LINE_GUIDE_OPTIONS;

      // The line guide polylines are reused across drawings — style them before
      // startPolygon() is called, otherwise they render with the default style.
      if (editTools.forwardLineGuide) {
        editTools.forwardLineGuide.setStyle(LINE_GUIDE_OPTIONS);
      }
      if (editTools.backwardLineGuide) {
        editTools.backwardLineGuide.setStyle(LINE_GUIDE_OPTIONS);
      }
    }

    this.currentDrawingPolygon = this.map.editTools.startPolygon(undefined, POLYGON_OPTIONS);

    if (this.currentDrawingPolygon) {
      this.currentDrawingPolygon.setStyle(POLYGON_OPTIONS);

      if (!this.map.hasLayer(this.currentDrawingPolygon)) {
        this.currentDrawingPolygon.addTo(this.map);
      }

      // Belt-and-suspenders: set on the editor too, startPolygon may not pick up
      // the map-level lineGuideOptions depending on plugin version.
      const editor = (this.currentDrawingPolygon as any).editor;
      if (editor) {
        editor.options.lineGuideOptions = {
          color: POLYGON_COLOR,
          weight: 2,
          opacity: 0.6,
          dashArray: '5, 5',
        };
      }
    }
  }

  private startEditingMode(polygonId: string): void {
    if (!this.map) return;

    const layer = this.polygonLayers.get(polygonId);
    if (!layer) return;

    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    this.originalCoordinates = latlngs.map((ll) => [ll.lat, ll.lng]);
    this.currentEditingPolygonId = polygonId;

    layer.setStyle({ dashArray: EDIT_STYLE.DASH_ARRAY });

    const mapContainer = this.map.getContainer();
    mapContainer.style.setProperty(CSS_VARIABLES.POLYGON_COLOR, POLYGON_COLOR);

    if (layer.enableEdit) {
      layer.enableEdit();
    }
  }

  private stopAllModes(): void {
    if (!this.map) return;
    this.map.doubleClickZoom.enable();
    this.originalCoordinates = null;
    const mapContainer = this.map.getContainer();
    mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
  }

  private onPolygonCreated(layer: L.Polygon): void {
    if (!layer) return;

    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const coordinates: Array<LatLng> = latlngs.map((ll) => [ll.lat, ll.lng]);

    if (!isSimplePolygon(coordinates)) {
      if (this.map && this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
      this.notificationService.warning(
        'El polígono no puede tener intersecciones consigo mismo. Por favor, dibuje un polígono simple.',
      );
      return;
    }

    const polygon = this.polygonService.createPolygon({ name: '', coordinates });

    layer.options.polygonId = polygon.id;
    this.polygonLayers.set(polygon.id, layer);

    layer.on(LEAFLET_EDITABLE_EVENTS.CONTEXT_MENU, (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      this.showPolygonContextMenu(polygon.id, e.containerPoint);
    });

    this.currentDrawingPolygon = null;
    this.polygonDrawingService.stopDrawing();
  }

  private onPolygonDrawingCancelled(): void {
    this.currentDrawingPolygon = null;
    this.polygonDrawingService.stopDrawing();
  }

  syncPolygons(polygons: Polygon[], editingPolygonId: string | null): void {
    if (!this.map) return;

    const currentIds = new Set(this.polygonLayers.keys());

    if (editingPolygonId && !polygons.find((p) => p.id === editingPolygonId)) {
      this.originalCoordinates = null;
      this.currentEditingPolygonId = null;
      this.polygonDrawingService.stopDrawing();
    }

    for (const polygon of polygons) {
      // Don't overwrite the layer while the user is actively dragging vertices
      if (editingPolygonId && polygon.id === editingPolygonId) {
        currentIds.delete(polygon.id);
        continue;
      }

      const existingLayer = this.polygonLayers.get(polygon.id);

      if (polygon.visible) {
        if (existingLayer) {
          this.updateExistingPolygonLayer(existingLayer, polygon);
        } else {
          this.createNewPolygonLayer(polygon);
        }
        currentIds.delete(polygon.id);
      } else {
        if (existingLayer) {
          this.map.removeLayer(existingLayer);
          this.polygonLayers.delete(polygon.id);
        }
        currentIds.delete(polygon.id);
      }
    }

    for (const oldId of currentIds) {
      const layer = this.polygonLayers.get(oldId);
      if (layer) {
        this.map.removeLayer(layer);
        this.polygonLayers.delete(oldId);
      }
      this.removeDepartmentLayers(oldId);
    }

    this.syncDepartmentLayers(polygons);
  }

  private syncDepartmentLayers(polygons: Polygon[]): void {
    if (!this.map) return;

    for (const polygon of polygons) {
      if (
        polygon.visible &&
        polygon.departments &&
        polygon.departments.length > 0 &&
        polygon.departmentsVisible
      ) {
        this.renderDepartmentLayers(polygon);
      } else {
        this.removeDepartmentLayers(polygon.id);
      }
    }
  }

  private renderDepartmentLayers(polygon: Polygon): void {
    if (!this.map || !polygon.departments) return;

    const departmentColor = lightenColor(POLYGON_COLOR, DEPARTMENT_STYLE.LIGHTEN_PERCENT);

    const existingLayers = this.departmentLayers.get(polygon.id);
    if (existingLayers && existingLayers.length > 0) {
      const newStyle = createDepartmentStyle(departmentColor);
      existingLayers.forEach((layer) => {
        layer.setStyle(newStyle);
        if (!this.map!.hasLayer(layer)) {
          layer.addTo(this.map!);
        }
      });

      const layersByName = this.departmentLayersByName.get(polygon.id);
      if (layersByName) {
        layersByName.forEach((entry) => {
          entry.baseColor = departmentColor;
        });
      }
      return;
    }

    if (!this.map.getPane(MAP_PANES.DEPARTMENTS)) {
      const pane = this.map.createPane(MAP_PANES.DEPARTMENTS);
      pane.style.zIndex = String(Z_INDEX.DEPARTMENTS);
      pane.style.pointerEvents = 'none';
    }

    const layers: L.GeoJSON[] = [];
    const layersByName = new Map<string, { layer: L.GeoJSON; baseColor: string }>();

    for (const dept of polygon.departments) {
      const geoJsonLayer = L.geoJSON(dept.geometry as any, {
        pane: MAP_PANES.DEPARTMENTS,
        interactive: false,
        style: createDepartmentStyle(departmentColor),
      });

      // `interactive: false` doesn't suppress pointer events on the SVG path in
      // all Leaflet versions — set it explicitly to keep the map clickable.
      geoJsonLayer.eachLayer((l: any) => {
        if (l._path) {
          l._path.style.pointerEvents = 'none';
        }
      });

      const tooltipText = dept.province ? `${dept.name} (${dept.province})` : dept.name;
      geoJsonLayer.bindTooltip(tooltipText, {
        permanent: false,
        direction: 'center',
        className: 'department-tooltip',
      });

      layersByName.set(dept.name, { layer: geoJsonLayer, baseColor: departmentColor });
      geoJsonLayer.addTo(this.map);
      layers.push(geoJsonLayer);
    }

    this.departmentLayers.set(polygon.id, layers);
    this.departmentLayersByName.set(polygon.id, layersByName);
  }

  private removeDepartmentLayers(polygonId: string): void {
    if (!this.map) return;

    const layers = this.departmentLayers.get(polygonId);
    if (layers) {
      layers.forEach((layer) => {
        this.map!.removeLayer(layer);
      });
      this.departmentLayers.delete(polygonId);
    }

    this.departmentLayersByName.delete(polygonId);
  }

  private updateExistingPolygonLayer(existingLayer: L.Polygon, polygon: Polygon): void {
    if (!this.map) return;

    existingLayer.off('edit');
    existingLayer.setStyle(POLYGON_OPTIONS);

    const currentLatLngs = existingLayer.getLatLngs()[0] as L.LatLng[];
    const newCoords = polygon.coordinates;
    let coordsChanged = currentLatLngs.length !== newCoords.length;

    if (!coordsChanged) {
      for (let i = 0; i < currentLatLngs.length; i++) {
        const current = currentLatLngs[i];
        const newCoord = newCoords[i];
        if (
          Math.abs(current.lat - newCoord[0]) > 0.000001 ||
          Math.abs(current.lng - newCoord[1]) > 0.000001
        ) {
          coordsChanged = true;
          break;
        }
      }
    }

    if (coordsChanged) {
      const latlngs: L.LatLngExpression[] = newCoords.map((coord: LatLng) => [coord[0], coord[1]]);
      existingLayer.setLatLngs(latlngs);
    }

    if (!this.map.hasLayer(existingLayer)) {
      existingLayer.addTo(this.map);
    }
  }

  private buildPolygonLayer(polygon: Polygon, coordinates: Array<LatLng>): L.Polygon {
    const latlngs: L.LatLngExpression[] = coordinates.map((coord) => [coord[0], coord[1]]);
    const layer = L.polygon(latlngs, { ...POLYGON_OPTIONS, polygonId: polygon.id });
    layer.on(LEAFLET_EDITABLE_EVENTS.CONTEXT_MENU, (e: L.LeafletMouseEvent) => {
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }
      this.showPolygonContextMenu(polygon.id, e.containerPoint);
    });
    return layer;
  }

  private createNewPolygonLayer(polygon: Polygon): void {
    if (!this.map) return;
    const layer = this.buildPolygonLayer(polygon, polygon.coordinates);
    this.polygonLayers.set(polygon.id, layer);
    layer.addTo(this.map);
  }

  private recreatePolygonLayer(polygonId: string, coordinates: Array<LatLng>): void {
    if (!this.map) return;

    const existing = this.polygonLayers.get(polygonId);
    if (existing) {
      this.map.removeLayer(existing);
      this.polygonLayers.delete(polygonId);
    }

    const polygon = this.polygonService.getPolygonById(polygonId);
    if (!polygon) return;

    const layer = this.buildPolygonLayer(polygon, coordinates);
    this.polygonLayers.set(polygon.id, layer);
    layer.addTo(this.map);
  }

  private showPolygonContextMenu(polygonId: string, point: L.Point): void {
    if (this.polygonDrawingService.drawingMode() !== DrawingMode.NONE) return;

    const polygon = this.polygonService.getPolygonById(polygonId);

    if (!polygon || !this.map) return;

    this.contextMenuAnchor.set({ x: point.x, y: point.y, polygonId });
  }

  closeContextMenu(): void {
    this.contextMenuAnchor.set(null);
  }

  handleContextMenuAction(action: PolygonContextMenuAction): void {
    this.closeContextMenu();

    // Without a delay the menu DOM is still visible when the action runs,
    // which can interfere with dialogs and focus management.
    setTimeout(() => {
      switch (action.type) {
        case PolygonContextMenuActionType.EDIT:
          this.polygonDrawingService.startEditMode(action.polygonId);
          break;

        case PolygonContextMenuActionType.VISIBILITY:
          this.polygonService.toggleVisibility(action.polygonId);
          break;

        case PolygonContextMenuActionType.DELETE:
          void this.confirmAndDeletePolygon(action.polygonId);
          break;

        case PolygonContextMenuActionType.CUT:
          this.handleCutAction(action.polygonId);
          break;

        case PolygonContextMenuActionType.UNDO_CUT:
          this.polygonService.undoCut(action.polygonId);
          break;

        case PolygonContextMenuActionType.TOGGLE_DEPARTMENTS:
          this.handleToggleDepartmentsAction(action.polygonId);
          break;

        case PolygonContextMenuActionType.HIDE_DEPARTMENTS:
          this.polygonService.hideDepartments(action.polygonId);
          break;

        case PolygonContextMenuActionType.GENERATE_ALERT:
          void this.alertEmissionService.emitAlert(action.polygonId);
          break;
      }
    }, ACTION_DELAYS.MENU_ACTION);
  }

  private confirmAndDeletePolygon(polygonId: string): void {
    const polygon = this.polygonService.getPolygonById(polygonId);
    const polygonName = polygon?.name || 'Sin nombre';

    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Eliminar polígono',
          message: `¿Está seguro que desea eliminar el polígono "${polygonName}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
          confirmColor: 'warn',
        },
      },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.polygonService.deletePolygon(polygonId);
      }
    });
  }

  private async handleCutAction(polygonId: string): Promise<void> {
    const success = await this.polygonService.cutPolygon(polygonId);
    if (!success) {
      console.error('[MapPolygonsService] Error al recortar polígono');
    }
  }

  private async handleToggleDepartmentsAction(polygonId: string): Promise<void> {
    const polygon = this.polygonService.getPolygonById(polygonId);
    if (!polygon) return;

    if (!polygon.departments || polygon.departments.length === 0) {
      const success = await this.polygonService.loadDepartments(polygonId);
      if (!success) {
        console.error('[MapPolygonsService] Error al cargar departamentos');
      }
    } else {
      this.polygonService.toggleDepartmentsVisibility(polygonId);
    }
  }

  savePolygonEdit(editingPolygonId: string | null): void {
    if (!editingPolygonId) return;

    const layer = this.polygonLayers.get(editingPolygonId);
    if (layer) {
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coordinates: Array<LatLng> = latlngs.map((ll) => [ll.lat, ll.lng]);

      if (!isSimplePolygon(coordinates)) {
        if (this.originalCoordinates && this.originalCoordinates.length > 0) {
          const originalLatLngs = this.originalCoordinates.map((coord) =>
            L.latLng(coord[0], coord[1]),
          );
          layer.setLatLngs([originalLatLngs]);
        }

        this.notificationService.warning(
          'El polígono no puede tener intersecciones consigo mismo. Se han restaurado las coordenadas originales.',
        );

        if (layer.disableEdit) {
          layer.disableEdit();
        }
        layer.setStyle({ dashArray: '' });

        this.originalCoordinates = null;
        this.currentEditingPolygonId = null;

        if (this.map) {
          const mapContainer = this.map.getContainer();
          mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
        }

        this.polygonDrawingService.stopDrawing();
        return;
      }

      // disableEdit() before updatePolygon() so vertex handles are gone before
      // a potential sync re-renders the layer.
      if (layer.disableEdit) {
        layer.disableEdit();
      }
      layer.setStyle({ dashArray: '' });

      this.polygonService.updatePolygon(editingPolygonId, { coordinates });
    }

    this.originalCoordinates = null;
    this.currentEditingPolygonId = null;

    if (this.map) {
      const mapContainer = this.map.getContainer();
      mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
    }

    this.polygonDrawingService.stopDrawing();
  }

  cancelPolygonEdit(editingPolygonId: string | null): void {
    if (!editingPolygonId || !this.map) return;

    const layer = this.polygonLayers.get(editingPolygonId);
    if (!layer) return;

    if (layer.disableEdit) {
      layer.disableEdit();
    }

    if (this.originalCoordinates) {
      this.recreatePolygonLayer(editingPolygonId, this.originalCoordinates);
    } else {
      layer.setStyle({ dashArray: '' });
    }

    this.originalCoordinates = null;
    this.currentEditingPolygonId = null;

    if (this.map) {
      const mapContainer = this.map.getContainer();
      mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
    }

    this.polygonDrawingService.stopDrawing();
  }

  private updateDepartmentHighlight(
    hovered: { polygonId: string; departmentNames: ReadonlyArray<string> } | null,
  ): void {
    if (!this.map) return;

    if (!hovered) {
      this.departmentLayersByName.forEach((layersByName) => {
        layersByName.forEach((entry) => {
          entry.layer.setStyle(createDepartmentStyle(entry.baseColor));
        });
      });
      return;
    }

    const { polygonId, departmentNames } = hovered;
    const layersByName = this.departmentLayersByName.get(polygonId);
    if (!layersByName) return;

    layersByName.forEach((entry) => {
      entry.layer.setStyle(createDepartmentStyle(entry.baseColor));
    });

    for (const departmentName of departmentNames) {
      const hoveredEntry = layersByName.get(departmentName);
      if (!hoveredEntry) continue;
      const highlightStyle = createDepartmentStyle(hoveredEntry.baseColor);
      highlightStyle.fillOpacity = (DEPARTMENT_STYLE.FILL_OPACITY || 0.2) * 2.5;
      highlightStyle.opacity = (DEPARTMENT_STYLE.OPACITY || 0.6) * 1.5;
      highlightStyle.weight = (DEPARTMENT_STYLE.WEIGHT || 2) * 1.5;
      hoveredEntry.layer.setStyle(highlightStyle);
      hoveredEntry.layer.bringToFront();
    }
  }

  destroy(): void {
    this.polygonLayers.forEach((layer) => layer.remove());
    this.polygonLayers.clear();

    this.departmentLayers.forEach((layers) => {
      layers.forEach((layer) => layer.remove());
    });
    this.departmentLayers.clear();
    this.departmentLayersByName.clear();
    this.closeContextMenu();

    this.map = null;
  }
}
