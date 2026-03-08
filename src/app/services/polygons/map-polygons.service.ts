import { Injectable, inject, ViewContainerRef, Injector, ComponentRef } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import * as L from 'leaflet';
import 'leaflet-editable';
import { PolygonService } from './polygon.service';
import { PolygonDrawingService, DrawingMode } from './polygon-drawing.service';
import { Polygon } from '../../models/polygon.model';
import {
  PolygonContextMenuComponent,
  PolygonContextMenuAction,
} from '../../components/polygon-context-menu/polygon-context-menu';

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

  private map: L.Map | null = null;
  private polygonLayers = new Map<string, L.Polygon>();
  private departmentLayers = new Map<string, L.GeoJSON[]>(); // polygonId -> array of department GeoJSON layers
  private currentDrawingPolygon: L.Polygon | null = null;
  private contextMenuOverlayRef: OverlayRef | null = null;
  private originalCoordinates: Array<[number, number]> | null = null;

  // These are needed for the context menu overlay
  private viewContainerRef: ViewContainerRef | null = null;
  private injector: Injector | null = null;

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
    // Event handler when a polygon drawing is complete
    this.map.on('editable:drawing:commit', (e: any) => {
      this.onPolygonCreated(e.layer);
    });

    // Event handler when a polygon drawing is cancelled
    this.map.on('editable:drawing:cancel', (e: any) => {
      this.onPolygonDrawingCancelled();
    });

    // Event handler when a click happens during drawing (to configure line guide color)
    this.map.on('editable:drawing:clicked', (e: any) => {
      const layer = e.layer;
      if (layer && layer.options) {
        const editor = (layer as any).editor;
        if (editor) {
          // Configure line guide with the polygon's color
          editor.options.lineGuideOptions = {
            color: layer.options.color,
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 5',
          };
        }
      }
    });

    // Event handler when polygon is being edited (vertex dragged)
    this.map.on('editable:vertex:dragend', (e: any) => {
      this.onPolygonEdited(e.layer);
    });

    // Event handler when a vertex is deleted during edit
    this.map.on('editable:vertex:deleted', (e: any) => {
      this.onPolygonEdited(e.layer);
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
    mapContainer.style.setProperty('--polygon-color', nextColor);

    // Create polygon options
    const polygonOptions: L.PolylineOptions = {
      color: nextColor,
      weight: 3,
      opacity: 0.8,
      fillColor: nextColor,
      fillOpacity: 0.2,
    };

    // Configure editOptions on the map before starting drawing
    // This ensures the line guide gets the correct options from the start
    const editTools = (this.map as any).editTools;
    if (editTools) {
      const lineGuideStyle = {
        color: nextColor,
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 5',
      };

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
      dashArray: '5, 5',
    });

    // Set CSS variable on the map container for editing markers to use
    const mapContainer = this.map.getContainer();
    mapContainer.style.setProperty('--polygon-color', polygonColor);

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
    mapContainer.style.removeProperty('--polygon-color');
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
    layer.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      this.showPolygonContextMenu(polygon.id, e.containerPoint);
    });

    // Clear the current drawing polygon reference
    this.currentDrawingPolygon = null;

    // Exit drawing mode after creating a polygon (this will re-enable double-click zoom)
    this.polygonDrawingService.stopDrawing();
  }

  /**
   * Handler when a polygon is being edited
   */
  private onPolygonEdited(layer: L.Polygon): void {
    if (!layer) return;

    const polygonId = layer.options.polygonId;

    if (polygonId) {
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coordinates: Array<[number, number]> = latlngs.map((ll) => [ll.lat, ll.lng]);

      // Note: We don't auto-save during editing anymore.
      // Saving is done when the user clicks the save button.
      // This just allows real-time visual updates if needed.
    }
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

    // Check if layers already exist
    const existingLayers = this.departmentLayers.get(polygon.id);
    if (existingLayers && existingLayers.length > 0) {
      // Layers already rendered, just ensure they're on the map
      existingLayers.forEach((layer) => {
        if (!this.map!.hasLayer(layer)) {
          layer.addTo(this.map!);
        }
      });
      return;
    }

    // Create custom pane for departments if it doesn't exist
    if (!this.map.getPane('departments')) {
      const pane = this.map.createPane('departments');
      pane.style.zIndex = '400';
      pane.style.pointerEvents = 'none';
    }

    // Create new layers
    const layers: L.GeoJSON[] = [];
    const departmentColor = this.lightenColor(polygon.color, 30);

    for (const dept of polygon.departments) {
      // Render the FULL department geometry (not just intersection)
      const geoJsonLayer = L.geoJSON(dept.geometry as any, {
        pane: 'departments',
        interactive: false,
        style: {
          color: departmentColor,
          weight: 2,
          opacity: 0.7,
          fillColor: departmentColor,
          fillOpacity: 0.15,
          dashArray: '3, 6',
        },
      });

      // Configure layer to be non-interactive
      geoJsonLayer.eachLayer((l: any) => {
        if (l._path) {
          l._path.style.pointerEvents = 'none';
        }
      });

      // Add tooltip with department info
      if (dept.properties && dept.properties['nam']) {
        geoJsonLayer.bindTooltip(dept.properties['nam'], {
          permanent: false,
          direction: 'center',
          className: 'department-tooltip',
        });
      }

      geoJsonLayer.addTo(this.map);
      layers.push(geoJsonLayer);
    }

    this.departmentLayers.set(polygon.id, layers);
  }

  /**
   * Lighten a hex color by a given percentage
   */
  private lightenColor(hex: string, percent: number): string {
    // Remove # if present
    const color = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    // Lighten each component
    const newR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    const newG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    const newB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

    // Convert back to hex
    return '#' + [newR, newG, newB].map((x) => x.toString(16).padStart(2, '0')).join('');
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
  }

  /**
   * Update an existing polygon layer
   */
  private updateExistingPolygonLayer(existingLayer: L.Polygon, polygon: Polygon): void {
    if (!this.map) return;

    // Remove any old 'edit' event listeners that auto-save
    existingLayer.off('edit');

    // Update existing layer style
    existingLayer.setStyle({
      color: polygon.color,
      fillColor: polygon.color,
      fillOpacity: 0.2,
    });

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
      color: polygon.color,
      fillColor: polygon.color,
      fillOpacity: 0.2,
      polygonId: polygon.id,
    });

    // Add context menu listener (right click)
    layer.on('contextmenu', (e: L.LeafletMouseEvent) => {
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
    switch (action.type) {
      case 'edit':
        setTimeout(() => {
          this.polygonDrawingService.startEditMode(action.polygonId);
        }, 100);
        break;
      case 'visibility':
        setTimeout(() => {
          this.polygonService.toggleVisibility(action.polygonId);
        }, 50);
        break;
      case 'delete':
        setTimeout(() => {
          this.polygonService.deletePolygon(action.polygonId);
        }, 100);
        break;
      case 'cut':
        setTimeout(async () => {
          const success = await this.polygonService.cutPolygon(action.polygonId);
          if (!success) {
            console.error('Error al recortar polígono');
          }
        }, 100);
        break;
      case 'undoCut':
        setTimeout(() => {
          this.polygonService.undoCut(action.polygonId);
        }, 100);
        break;
      case 'toggleDepartments':
        setTimeout(async () => {
          const polygon = this.polygonService.getPolygonById(action.polygonId);
          if (!polygon) return;

          if (!polygon.departments || polygon.departments.length === 0) {
            // Load departments
            const success = await this.polygonService.loadDepartments(action.polygonId);
            if (!success) {
              console.error('Error al cargar departamentos');
            }
          } else {
            // Toggle visibility
            this.polygonService.toggleDepartmentsVisibility(action.polygonId);
          }
        }, 100);
        break;
      case 'hideDepartments':
        setTimeout(() => {
          this.polygonService.hideDepartments(action.polygonId);
        }, 100);
        break;
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
      mapContainer.style.removeProperty('--polygon-color');
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
          color: polygon.color,
          fillColor: polygon.color,
          fillOpacity: 0.2,
          polygonId: polygon.id,
        });

        // Add context menu listener
        newLayer.on('contextmenu', (e: L.LeafletMouseEvent) => {
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
      mapContainer.style.removeProperty('--polygon-color');
    }

    // Exit edit mode
    this.polygonDrawingService.stopDrawing();
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

    if (this.contextMenuOverlayRef) {
      this.contextMenuOverlayRef.dispose();
      this.contextMenuOverlayRef = null;
    }

    this.map = null;
    this.viewContainerRef = null;
    this.injector = null;
  }
}
