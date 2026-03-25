import {
  Injectable,
  inject,
  ViewContainerRef,
  Injector,
  ComponentRef,
  effect,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import * as L from 'leaflet';
import 'leaflet-editable';
import { PolygonService } from './polygon.service';
import { PolygonDrawingService, DrawingMode } from './polygon-drawing.service';
import { Polygon } from '../../models/geo';
import { PolygonContextMenuComponent } from '../../components/polygon-context-menu/polygon-context-menu';
import {
  PolygonContextMenuAction,
  PolygonContextMenuActionType,
} from '../../models/polygon-context-menu-action.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../components/confirm-dialog/confirm-dialog';
import {
  LEAFLET_EDITABLE_EVENTS,
  CSS_VARIABLES,
  MAP_PANES,
} from '../../constants/map-polygons.constants';
import { Z_INDEX, EDIT_STYLE, DEPARTMENT_STYLE } from '../../config/map-polygons.config';
import {
  createPolygonOptions,
  createLineGuideOptions,
  createDepartmentStyle,
  lightenColor,
} from '../../utils/map-styles.utils';
import { ACTION_DELAYS } from '../../config/timing.config';

// Extended types for leaflet
declare module 'leaflet' {
  interface PolylineOptions {
    polygonId?: string;
  }
}

/**
 * Service responsible for handling polygon drawing, editing, and rendering on the map
 */
@Injectable({
  providedIn: 'root',
})
export class MapPolygonsService {
  private polygonService = inject(PolygonService);
  private polygonDrawingService = inject(PolygonDrawingService);
  private overlay = inject(Overlay);
  private dialog = inject(MatDialog);

  private map: L.Map | null = null;
  private polygonLayers = new Map<string, L.Polygon>();
  private departmentLayers = new Map<string, L.GeoJSON[]>(); // polygonId -> array of department GeoJSON layers
  private departmentLayersByName = new Map<
    string,
    Map<string, { layer: L.GeoJSON; baseColor: string }>
  >(); // polygonId -> (departmentName -> layer)
  private currentDrawingPolygon: L.Polygon | null = null;
  private contextMenuOverlayRef: OverlayRef | null = null;
  private originalCoordinates: Array<[number, number]> | null = null;

  // These are needed for the context menu overlay
  private viewContainerRef: ViewContainerRef | null = null;
  private injector: Injector | null = null;

  constructor() {
    // Listen to hovered department changes and update styles
    effect(() => {
      const hovered = this.polygonService.hoveredDepartment();
      this.updateDepartmentHighlight(hovered);
    });
  }

  /**
   * Initialize the service with a Leaflet map instance and Angular dependencies
   */
  initialize(map: L.Map, viewContainerRef: ViewContainerRef, injector: Injector): void {
    this.map = map;
    this.viewContainerRef = viewContainerRef;
    this.injector = injector;
    this.initPolygonDrawing();
  }

  /**
   * Initialize polygon drawing with Leaflet.Editable
   */
  private initPolygonDrawing(): void {
    if (!this.map) return;

    // Leaflet.Editable auto-initializes with the map
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
        editor.options.lineGuideOptions = createLineGuideOptions(layer.options.color);
      }
    });
  }

  /**
   * Handle drawing mode changes
   */
  handleDrawingModeChange(mode: DrawingMode, editingPolygonId: string | null): void {
    if (!this.map) return;

    // Cancel any active drawing (removes the incomplete polygon)
    if (this.currentDrawingPolygon) {
      // Remove the incomplete polygon from the map
      if (this.map.hasLayer(this.currentDrawingPolygon)) {
        this.map.removeLayer(this.currentDrawingPolygon);
      }
      // Stop the drawing process
      this.map.editTools.stopDrawing();
      this.currentDrawingPolygon = null;
    }

    // Disable editing on all polygons
    this.polygonLayers.forEach((layer) => {
      if (layer.disableEdit) {
        layer.disableEdit();
      }
    });

    // Enable the requested mode
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
        // Re-enable double-click zoom if it was disabled
        this.map.doubleClickZoom.enable();
        // Note: DELETE mode is now handled via context menu, not as a mode
        break;

      case DrawingMode.NONE:
        this.stopAllModes();
        break;
    }
  }

  /**
   * Start drawing mode
   */
  private startDrawingMode(): void {
    if (!this.map) return;

    // Disable double-click zoom to avoid conflicts
    this.map.doubleClickZoom.disable();

    // Get the color that will be used for the next polygon
    const nextColor = this.polygonService.getNextAvailableColor();

    // Set the color CSS variable for this polygon's handlers
    const mapContainer = this.map.getContainer();
    mapContainer.style.setProperty(CSS_VARIABLES.POLYGON_COLOR, nextColor);

    // Create polygon options
    const polygonOptions = createPolygonOptions(nextColor);

    // Configure editOptions on the map before starting drawing
    const editTools = (this.map as any).editTools;
    if (editTools) {
      const lineGuideStyle = createLineGuideOptions(nextColor);

      // Configure in editTools options
      editTools.options = editTools.options || {};
      editTools.options.lineGuideOptions = lineGuideStyle;

      // CRITICAL: Apply style directly to the line guide polylines
      // These are reused objects that need to be styled before drawing starts
      if (editTools.forwardLineGuide) {
        editTools.forwardLineGuide.setStyle(lineGuideStyle);
      }
      if (editTools.backwardLineGuide) {
        editTools.backwardLineGuide.setStyle(lineGuideStyle);
      }
    }

    // Start drawing a new polygon
    this.currentDrawingPolygon = this.map.editTools.startPolygon(undefined, polygonOptions);

    // Apply the style to the drawing polygon and its editor
    if (this.currentDrawingPolygon) {
      // Set style on the polygon itself
      this.currentDrawingPolygon.setStyle(polygonOptions);

      // Add temporary layer to map if not already added
      if (!this.map.hasLayer(this.currentDrawingPolygon)) {
        this.currentDrawingPolygon.addTo(this.map);
      }

      // Also set line guide options directly on the editor as a backup
      const editor = (this.currentDrawingPolygon as any).editor;
      if (editor) {
        editor.options.lineGuideOptions = {
          color: nextColor,
          weight: 2,
          opacity: 0.6,
          dashArray: '5, 5',
        };
      }
    }
  }

  /**
   * Start editing mode for a specific polygon
   */
  private startEditingMode(polygonId: string): void {
    if (!this.map) return;

    const layer = this.polygonLayers.get(polygonId);
    if (!layer) return;

    const latlngs = layer.getLatLngs()[0] as L.LatLng[];

    // Save original coordinates before editing for potential cancellation
    this.originalCoordinates = latlngs.map((ll) => [ll.lat, ll.lng]);

    // Get polygon color for custom markers
    const polygonColor = (layer.options as any).color || '#3388ff';

    // Apply dashed line style
    layer.setStyle({
      dashArray: EDIT_STYLE.DASH_ARRAY,
    });

    // Set CSS variable on the map container for editing markers to use
    const mapContainer = this.map.getContainer();
    mapContainer.style.setProperty(CSS_VARIABLES.POLYGON_COLOR, polygonColor);

    // Enable editing
    if (layer.enableEdit) {
      layer.enableEdit();
    }
  }

  /**
   * Stop all editing/drawing modes
   */
  private stopAllModes(): void {
    if (!this.map) return;

    // Re-enable double-click zoom
    this.map.doubleClickZoom.enable();

    // Clear any saved original coordinates
    this.originalCoordinates = null;

    // Clear the polygon color CSS variable
    const mapContainer = this.map.getContainer();
    mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
  }

  /**
   * Handler when a new polygon is created
   */
  private onPolygonCreated(layer: L.Polygon): void {
    if (!layer) return;

    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);

    // Create polygon in service
    const polygon = this.polygonService.createPolygon({
      name: '',
      coordinates,
    });

    // Store polygon id in layer options and reference
    layer.options.polygonId = polygon.id;
    this.polygonLayers.set(polygon.id, layer);

    // Add context menu listener (right click)
    layer.on(LEAFLET_EDITABLE_EVENTS.CONTEXT_MENU, (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      this.showPolygonContextMenu(polygon.id, e.containerPoint);
    });

    // Clear the current drawing polygon reference
    this.currentDrawingPolygon = null;

    // Exit drawing mode after creating a polygon (this will re-enable double-click zoom)
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Handler when a polygon drawing is cancelled
   */
  private onPolygonDrawingCancelled(): void {
    // Clear the current drawing polygon reference
    this.currentDrawingPolygon = null;

    // Exit drawing mode and clean up
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Synchronize polygons on the map with the service
   */
  syncPolygons(polygons: Polygon[], editingPolygonId: string | null): void {
    if (!this.map) return;

    // Get current polygon IDs on map
    const currentIds = new Set(this.polygonLayers.keys());

    // Check if the polygon being edited was deleted
    if (editingPolygonId && !polygons.find((p) => p.id === editingPolygonId)) {
      // Polygon being edited was deleted, exit edit mode
      this.polygonDrawingService.stopDrawing();
      this.originalCoordinates = null;
    }

    // Process all polygons from service
    for (const polygon of polygons) {
      // Skip the polygon being edited to avoid interfering with active edits
      if (editingPolygonId && polygon.id === editingPolygonId) {
        currentIds.delete(polygon.id);
        continue;
      }

      const existingLayer = this.polygonLayers.get(polygon.id);

      if (polygon.visible) {
        if (existingLayer) {
          this.updateExistingPolygonLayer(existingLayer, polygon);
          currentIds.delete(polygon.id);
        } else {
          this.createNewPolygonLayer(polygon);
          currentIds.delete(polygon.id);
        }
      } else {
        // Hide polygon
        if (existingLayer) {
          this.map.removeLayer(existingLayer);
          this.polygonLayers.delete(polygon.id);
        }
        currentIds.delete(polygon.id);
      }
    }

    // Remove layers for polygons that no longer exist
    for (const oldId of currentIds) {
      const layer = this.polygonLayers.get(oldId);
      if (layer) {
        this.map.removeLayer(layer);
        this.polygonLayers.delete(oldId);
      }
      // Also remove associated department layers
      this.removeDepartmentLayers(oldId);
    }

    // Sync department layers
    this.syncDepartmentLayers(polygons);
  }

  /**
   * Sync department layers for all polygons
   */
  private syncDepartmentLayers(polygons: Polygon[]): void {
    if (!this.map) return;

    // Track which polygons should have departments visible
    const visibleDepartments = new Set<string>();

    for (const polygon of polygons) {
      if (
        polygon.visible &&
        polygon.departments &&
        polygon.departments.length > 0 &&
        polygon.departmentsVisible
      ) {
        visibleDepartments.add(polygon.id);
        this.renderDepartmentLayers(polygon);
      } else {
        // Remove department layers if they shouldn't be visible
        this.removeDepartmentLayers(polygon.id);
      }
    }
  }

  /**
   * Render department layers for a polygon
   */
  private renderDepartmentLayers(polygon: Polygon): void {
    if (!this.map || !polygon.departments) return;

    // Calculate the department color based on the polygon's current color
    const departmentColor = lightenColor(polygon.color, DEPARTMENT_STYLE.LIGHTEN_PERCENT);

    // Check if layers already exist
    const existingLayers = this.departmentLayers.get(polygon.id);
    if (existingLayers && existingLayers.length > 0) {
      // Update existing layers with the new color
      const newStyle = createDepartmentStyle(departmentColor);
      existingLayers.forEach((layer) => {
        // Update the style with the new color
        layer.setStyle(newStyle);
        // Ensure they're on the map
        if (!this.map!.hasLayer(layer)) {
          layer.addTo(this.map!);
        }
      });

      // Update stored colors in the by-name map
      const layersByName = this.departmentLayersByName.get(polygon.id);
      if (layersByName) {
        layersByName.forEach((entry) => {
          entry.baseColor = departmentColor;
        });
      }
      return;
    }

    // Create custom pane for departments if it doesn't exist
    if (!this.map.getPane(MAP_PANES.DEPARTMENTS)) {
      const pane = this.map.createPane(MAP_PANES.DEPARTMENTS);
      pane.style.zIndex = String(Z_INDEX.DEPARTMENTS);
      pane.style.pointerEvents = 'none';
    }

    // Create new layers
    const layers: L.GeoJSON[] = [];
    const layersByName = new Map<string, { layer: L.GeoJSON; baseColor: string }>();

    for (const dept of polygon.departments) {
      // Render the department geometry
      const geoJsonLayer = L.geoJSON(dept.geometry as any, {
        pane: MAP_PANES.DEPARTMENTS,
        interactive: false,
        style: createDepartmentStyle(departmentColor),
      });

      // Configure layer to be non-interactive
      geoJsonLayer.eachLayer((l: any) => {
        if (l._path) {
          l._path.style.pointerEvents = 'none';
        }
      });

      // Add tooltip with department info
      geoJsonLayer.bindTooltip(dept.name, {
        permanent: false,
        direction: 'center',
        className: 'department-tooltip',
      });

      // Store layer reference by name
      layersByName.set(dept.name, {
        layer: geoJsonLayer,
        baseColor: departmentColor,
      });

      geoJsonLayer.addTo(this.map);
      layers.push(geoJsonLayer);
    }

    this.departmentLayers.set(polygon.id, layers);
    this.departmentLayersByName.set(polygon.id, layersByName);
  }

  /**
   * Remove department layers for a polygon
   */
  private removeDepartmentLayers(polygonId: string): void {
    if (!this.map) return;

    const layers = this.departmentLayers.get(polygonId);
    if (layers) {
      layers.forEach((layer) => {
        this.map!.removeLayer(layer);
      });
      this.departmentLayers.delete(polygonId);
    }

    // Also clean up the by-name map
    this.departmentLayersByName.delete(polygonId);
  }

  /**
   * Update an existing polygon layer
   */
  private updateExistingPolygonLayer(existingLayer: L.Polygon, polygon: Polygon): void {
    if (!this.map) return;

    // Remove any old 'edit' event listeners that auto-save
    existingLayer.off('edit');

    // Update existing layer style
    existingLayer.setStyle(createPolygonOptions(polygon.color));

    // Check if coordinates actually changed before updating
    const currentLatLngs = existingLayer.getLatLngs()[0] as L.LatLng[];
    const newCoords = polygon.coordinates;
    let coordsChanged = currentLatLngs.length !== newCoords.length;

    if (!coordsChanged) {
      // Compare each coordinate
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
      const latlngs: L.LatLngExpression[] = newCoords.map((coord: [number, number]) => [
        coord[0],
        coord[1],
      ]);
      existingLayer.setLatLngs(latlngs);
    }

    // Ensure the layer is on the map
    if (!this.map.hasLayer(existingLayer)) {
      existingLayer.addTo(this.map);
    }
  }

  /**
   * Create a new polygon layer
   */
  private createNewPolygonLayer(polygon: Polygon): void {
    if (!this.map) return;

    const latlngs: L.LatLngExpression[] = polygon.coordinates.map((coord: [number, number]) => [
      coord[0],
      coord[1],
    ]);
    const layer = L.polygon(latlngs, {
      ...createPolygonOptions(polygon.color),
      polygonId: polygon.id,
    });

    // Add context menu listener (right click)
    layer.on(LEAFLET_EDITABLE_EVENTS.CONTEXT_MENU, (e: L.LeafletMouseEvent) => {
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }
      this.showPolygonContextMenu(polygon.id, e.containerPoint);
    });

    this.polygonLayers.set(polygon.id, layer);
    layer.addTo(this.map);
  }

  /**
   * Show polygon context menu
   */
  private showPolygonContextMenu(polygonId: string, point: L.Point): void {
    const polygon = this.polygonService.getPolygonById(polygonId);

    if (!polygon || !this.map || !this.viewContainerRef || !this.injector) return;

    // Close any existing context menu
    if (this.contextMenuOverlayRef) {
      this.contextMenuOverlayRef.dispose();
      this.contextMenuOverlayRef = null;
    }

    // Get the map container and calculate absolute position
    const mapContainer = this.map.getContainer();
    const containerRect = mapContainer.getBoundingClientRect();
    const x = containerRect.left + point.x;
    const y = containerRect.top + point.y;

    // Create overlay at the click position
    const positionStrategy = this.overlay.position().global().left(`${x}px`).top(`${y}px`);

    this.contextMenuOverlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });

    // Create and attach the context menu component
    const portal = new ComponentPortal(
      PolygonContextMenuComponent,
      this.viewContainerRef,
      this.injector,
    );
    const componentRef: ComponentRef<PolygonContextMenuComponent> =
      this.contextMenuOverlayRef.attach(portal);

    // Set component inputs
    componentRef.instance.polygonId = polygonId;
    componentRef.instance.polygonVisible = polygon.visible;
    componentRef.instance.hasDepartments = !!polygon.departments && polygon.departments.length > 0;
    componentRef.instance.departmentsVisible = polygon.departmentsVisible || false;
    componentRef.instance.canUndoCut = !!polygon.originalCoordinates;
    componentRef.instance.isLoadingCut = this.polygonService.isPolygonBeingCut(polygonId);
    componentRef.instance.isLoadingDepartments =
      this.polygonService.isDepartmentsLoading(polygonId);

    // Handle menu actions
    componentRef.instance.action.subscribe((action: PolygonContextMenuAction) => {
      this.handleContextMenuAction(action);
      this.contextMenuOverlayRef?.dispose();
      this.contextMenuOverlayRef = null;
    });

    // Close menu when backdrop is clicked
    this.contextMenuOverlayRef.backdropClick().subscribe(() => {
      this.contextMenuOverlayRef?.dispose();
      this.contextMenuOverlayRef = null;
    });
  }

  /**
   * Handle context menu actions
   */
  private handleContextMenuAction(action: PolygonContextMenuAction): void {
    // Small delay to ensure menu closes before action execution
    setTimeout(() => {
      switch (action.type) {
        case PolygonContextMenuActionType.EDIT:
          this.polygonDrawingService.startEditMode(action.polygonId);
          break;

        case PolygonContextMenuActionType.VISIBILITY:
          this.polygonService.toggleVisibility(action.polygonId);
          break;

        case PolygonContextMenuActionType.DELETE:
          this.confirmAndDeletePolygon(action.polygonId);
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
      }
    }, ACTION_DELAYS.MENU_ACTION);
  }

  /**
   * Confirm and delete polygon
   */
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

  /**
   * Handle cut polygon action
   */
  private async handleCutAction(polygonId: string): Promise<void> {
    const success = await this.polygonService.cutPolygon(polygonId);
    if (!success) {
      console.error('[MapPolygonsService] Error al recortar polígono');
    }
  }

  /**
   * Handle toggle departments action
   */
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

  /**
   * Save the current polygon edit
   */
  savePolygonEdit(editingPolygonId: string | null): void {
    if (!editingPolygonId) return;

    const layer = this.polygonLayers.get(editingPolygonId);
    if (layer) {
      // Get current coordinates before disabling
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);

      // Disable editing first to clean up markers
      if (layer.disableEdit) {
        layer.disableEdit();
      }

      // Remove dashed line style
      layer.setStyle({
        dashArray: '',
      });

      // Update polygon in service
      this.polygonService.updatePolygon(editingPolygonId, { coordinates });
    }

    // Clear saved original coordinates
    this.originalCoordinates = null;

    // Clear the polygon color CSS variable
    if (this.map) {
      const mapContainer = this.map.getContainer();
      mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
    }

    // Exit edit mode
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Cancel the current polygon edit
   */
  cancelPolygonEdit(editingPolygonId: string | null): void {
    if (!editingPolygonId || !this.map) return;

    const layer = this.polygonLayers.get(editingPolygonId);
    if (!layer) return;

    if (layer.disableEdit) {
      layer.disableEdit();
    }

    // Remove dashed line style
    layer.setStyle({
      dashArray: '',
    });

    // Remove the layer and recreate it with original coordinates to avoid breaking edit capabilities
    if (this.originalCoordinates) {
      // Remove old layer
      this.map.removeLayer(layer);
      this.polygonLayers.delete(editingPolygonId);

      // Get polygon data from service
      const polygon = this.polygonService.getPolygonById(editingPolygonId);
      if (polygon) {
        // Create new layer with original coordinates
        const latlngs: L.LatLngExpression[] = this.originalCoordinates.map((coord) => [
          coord[0],
          coord[1],
        ]);
        const newLayer = L.polygon(latlngs, {
          ...createPolygonOptions(polygon.color),
          polygonId: polygon.id,
        });

        // Add context menu listener
        newLayer.on(LEAFLET_EDITABLE_EVENTS.CONTEXT_MENU, (e: L.LeafletMouseEvent) => {
          if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
            L.DomEvent.preventDefault(e.originalEvent);
          }
          this.showPolygonContextMenu(polygon.id, e.containerPoint);
        });

        // Add to map
        this.polygonLayers.set(polygon.id, newLayer);
        newLayer.addTo(this.map);
      }
    }

    // Clear saved original coordinates
    this.originalCoordinates = null;

    // Clear the polygon color CSS variable
    if (this.map) {
      const mapContainer = this.map.getContainer();
      mapContainer.style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
    }

    // Exit edit mode
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Update department highlight based on hover state
   */
  private updateDepartmentHighlight(
    hovered: { polygonId: string; departmentName: string } | null,
  ): void {
    if (!this.map) return;

    // If there's no hover, reset all departments to their base color
    if (!hovered) {
      this.departmentLayersByName.forEach((layersByName, polygonId) => {
        layersByName.forEach((entry, departmentName) => {
          const baseStyle = createDepartmentStyle(entry.baseColor);
          entry.layer.setStyle(baseStyle);
        });
      });
      return;
    }

    const { polygonId, departmentName } = hovered;
    const layersByName = this.departmentLayersByName.get(polygonId);
    if (!layersByName) return;

    // Reset all departments in this polygon to base color
    layersByName.forEach((entry) => {
      const baseStyle = createDepartmentStyle(entry.baseColor);
      entry.layer.setStyle(baseStyle);
    });

    // Highlight the hovered department
    const hoveredEntry = layersByName.get(departmentName);
    if (hoveredEntry) {
      // Create a highlighted style with increased opacity and weight
      const highlightStyle = createDepartmentStyle(hoveredEntry.baseColor);
      highlightStyle.fillOpacity = (DEPARTMENT_STYLE.FILL_OPACITY || 0.2) * 2.5; // Increase opacity
      highlightStyle.opacity = (DEPARTMENT_STYLE.OPACITY || 0.6) * 1.5; // Increase border opacity
      highlightStyle.weight = (DEPARTMENT_STYLE.WEIGHT || 2) * 1.5; // Increase border weight

      hoveredEntry.layer.setStyle(highlightStyle);

      // Bring the layer to front
      hoveredEntry.layer.bringToFront();
    }
  }

  /**
   * Clean up when destroying
   */
  destroy(): void {
    this.polygonLayers.forEach((layer) => layer.remove());
    this.polygonLayers.clear();

    // Clean up department layers
    this.departmentLayers.forEach((layers) => {
      layers.forEach((layer) => layer.remove());
    });
    this.departmentLayers.clear();
    this.departmentLayersByName.clear();

    if (this.contextMenuOverlayRef) {
      this.contextMenuOverlayRef.dispose();
      this.contextMenuOverlayRef = null;
    }

    this.map = null;
    this.viewContainerRef = null;
    this.injector = null;
  }
}
