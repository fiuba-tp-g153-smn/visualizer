/// <reference types="leaflet-editable" />
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  CircleMarkerOptions,
  DomEvent,
  LatLng,
  LayerGroup,
  Map as LeafletMap,
  Polyline,
  PolylineOptions,
  Tooltip,
  circleMarker,
  layerGroup,
  polyline,
  tooltip,
} from 'leaflet';
import { DrawingMode, PolygonDrawingService } from '../polygons/polygon-drawing.service';
import { MapContextMenuService } from '../map-context-menu/map-context-menu.service';
import {
  MapContextMenuItem,
  MapContextMenuSection,
} from '../map-context-menu/map-context-menu.models';
import { CSS_VARIABLES } from '../../constants/map-polygons.constants';
import { ensureEditTools } from '../../utils/leaflet-edit-tools';
import { GeoPoint, formatDistance, pathSegmentsMeters } from '../../utils/distance.utils';
import { MAP_TEXTS } from '../../texts';

/**
 * - `idle`: nothing on the map.
 * - `measuring`: left clicks add vertices.
 * - `done`: the path stays on the map; clicks go back to the point query.
 * - `editing`: vertices can be dragged, added and removed, like a polygon being edited.
 */
export type DistanceToolMode = 'idle' | 'measuring' | 'done' | 'editing';

/** Themed like the search-result polygon, so map annotations share one visual language. */
const PATH_STYLE: PolylineOptions = {
  color: 'var(--mat-sys-primary)',
  weight: 3,
  dashArray: '6, 6',
  interactive: false,
};

const VERTEX_STYLE: CircleMarkerOptions = {
  radius: 5,
  color: 'var(--mat-sys-surface)',
  weight: 2,
  fillColor: 'var(--mat-sys-primary)',
  fillOpacity: 1,
  interactive: false,
};

/** Edit handles take the path's color through the variable the polygon styles read. */
const EDIT_HANDLE_COLOR = 'var(--mat-sys-primary)';

/** Class added to the map container while measuring (crosshair cursor). */
const MEASURING_CLASS = 'distance-measuring';

const toGeoPoints = (latLngs: readonly LatLng[]): GeoPoint[] =>
  latLngs.map(({ lat, lng }) => ({ lat, lng }));

/**
 * Medición de distancias desde el menú contextual del mapa. "Medir distancia" activa el
 * modo, igual que dibujar un polígono: cada clic agrega un vértice y el total (geodésico,
 * haversine) se muestra junto al último. Mientras mide o edita, los clics no llegan a la consulta
 * puntual. Al terminar, el recorrido queda en el mapa y puede editarse como un polígono
 * (arrastrar, agregar o quitar vértices) hasta borrarlo o empezar otro.
 */
@Injectable({ providedIn: 'root' })
export class DistanceToolService {
  private readonly polygonDrawingService = inject(PolygonDrawingService);
  private readonly contextMenuService = inject(MapContextMenuService);

  private map: LeafletMap | null = null;
  /** Esc finishes measuring / saves an edit; kept to remove it when the map goes away. */
  private readonly escapeHandler = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    if (this.modeState() === 'measuring') this.finish();
    if (this.modeState() === 'editing') this.saveEdit();
  };
  private readonly overlay: LayerGroup = layerGroup();
  private readonly path: Polyline = polyline([], PATH_STYLE);
  private readonly vertices: LayerGroup = layerGroup();
  private readonly label: Tooltip = tooltip({
    permanent: true,
    direction: 'right',
    offset: [8, 0],
    className: 'distance-total-tooltip',
  });

  private readonly modeState = signal<DistanceToolMode>('idle');
  private readonly pointsState = signal<readonly GeoPoint[]>([]);
  /** Path before editing, restored on cancel. */
  private pointsBeforeEdit: readonly GeoPoint[] = [];

  readonly mode = this.modeState.asReadonly();
  readonly points = this.pointsState.asReadonly();
  readonly isEditing = computed(() => this.modeState() === 'editing');

  readonly segmentsMeters = computed(() => pathSegmentsMeters(this.pointsState()));
  readonly totalMeters = computed(() => this.segmentsMeters().reduce((a, b) => a + b, 0));

  constructor() {
    this.contextMenuService.register(0, () => this.contextMenuSection());
    this.overlay.addLayer(this.path).addLayer(this.vertices);
    // Editing hands the path's latlngs to leaflet-editable; mirror every change into state.
    this.path.on('editable:editing', () => {
      this.pointsState.set(toGeoPoints(this.path.getLatLngs() as LatLng[]));
    });

    effect(() => this.render(this.modeState(), this.pointsState()));

    // Entering polygon drawing/editing keeps the measurement's edits and frees the editor.
    effect(() => {
      if (this.polygonDrawingService.drawingMode() !== DrawingMode.NONE) {
        untracked(() => {
          if (this.modeState() === 'editing') this.saveEdit();
          if (this.modeState() === 'measuring') this.finish();
        });
      }
    });
  }

  initialize(map: LeafletMap): void {
    this.map = map;
    this.overlay.addTo(map);
    DomEvent.on(document.body, 'keydown', this.escapeHandler);
    this.render(this.modeState(), this.pointsState());
  }

  /**
   * Detaches from a map that is being torn down (the map is recreated when navigating back
   * to it). The measurement itself is kept and reappears on the next `initialize`.
   */
  destroy(): void {
    // Editing is bound to this map's leaflet-editable tools: keep the edits and end the
    // editor now (the render effect that would do it runs after the map is gone).
    this.saveEdit();
    if (this.path.editEnabled?.()) this.path.disableEdit();
    DomEvent.off(document.body, 'keydown', this.escapeHandler);
    this.overlay.remove();
    this.map = null;
  }

  /**
   * Adds a vertex while measuring. Returns whether the click was consumed, so the
   * caller can skip other click handlers (point query).
   */
  handleMapClick(lat: number, lng: number): boolean {
    if (this.isDrawingPolygons()) return false;
    switch (this.modeState()) {
      case 'measuring':
        this.pointsState.update((points) => [...points, { lat, lng }]);
        return true;
      case 'editing':
        return true;
      default:
        return false;
    }
  }

  /** Enters measuring mode; the next left click places the first vertex. */
  start(): void {
    this.pointsState.set([]);
    this.modeState.set('measuring');
  }

  /** Stops adding vertices; a path with a single point has nothing to show and is cleared. */
  finish(): void {
    if (this.pointsState().length < 2) {
      this.clear();
      return;
    }
    this.modeState.set('done');
  }

  /** Removes the last vertex; measuring continues even with no vertices left. */
  removeLastPoint(): void {
    this.pointsState.update((points) => points.slice(0, -1));
  }

  startEdit(): void {
    if (this.modeState() !== 'done') return;
    this.pointsBeforeEdit = this.pointsState();
    this.modeState.set('editing');
  }

  saveEdit(): void {
    if (this.modeState() !== 'editing') return;
    this.modeState.set('done');
  }

  cancelEdit(): void {
    if (this.modeState() !== 'editing') return;
    this.pointsState.set(this.pointsBeforeEdit);
    this.modeState.set('done');
  }

  clear(): void {
    this.pointsState.set([]);
    this.modeState.set('idle');
  }

  /**
   * Measurement actions for the map's context menu. While measuring or editing the
   * section is exclusive, so the menu offers nothing unrelated to the measurement.
   */
  private contextMenuSection(): MapContextMenuSection {
    const item = (
      id: string,
      icon: string,
      label: string,
      run: () => void,
    ): MapContextMenuItem => ({
      id: `distance-${id}`,
      icon,
      label,
      run,
    });
    const clear = item('clear', 'delete_outline', MAP_TEXTS.distance.clear, () => this.clear());

    switch (this.modeState()) {
      case 'idle':
        return {
          items: [item('start', 'straighten', MAP_TEXTS.distance.start, () => this.start())],
        };
      case 'measuring':
        // Nothing placed yet: the only thing to do is back out.
        if (this.pointsState().length === 0) {
          return {
            exclusive: true,
            items: [item('cancel', 'close', MAP_TEXTS.distance.cancel, () => this.clear())],
          };
        }
        return {
          exclusive: true,
          items: [
            item('finish', 'check', MAP_TEXTS.distance.finish, () => this.finish()),
            item('undo', 'undo', MAP_TEXTS.distance.undo, () => this.removeLastPoint()),
            clear,
          ],
        };
      case 'done':
        return {
          items: [
            item('edit', 'edit', MAP_TEXTS.distance.edit, () => this.startEdit()),
            item('restart', 'straighten', MAP_TEXTS.distance.restart, () => this.start()),
            clear,
          ],
        };
      case 'editing':
        // The edit dock owns saving/cancelling; keep the menu closed meanwhile.
        return { exclusive: true, items: [] };
    }
  }

  private isDrawingPolygons(): boolean {
    return this.polygonDrawingService.drawingMode() !== DrawingMode.NONE;
  }

  private render(mode: DistanceToolMode, points: readonly GeoPoint[]): void {
    const map = this.map;
    if (!map) return;

    map.getContainer().classList.toggle(MEASURING_CLASS, mode === 'measuring');
    // A double click would add two vertices and zoom; keep it for vertices only.
    if (mode === 'measuring' || mode === 'editing') {
      map.doubleClickZoom.disable();
    } else if (!this.isDrawingPolygons()) {
      map.doubleClickZoom.enable();
    }

    this.renderEditing(map, mode === 'editing', points);

    // While editing, leaflet-editable owns the path and draws its own vertex handles.
    this.vertices.clearLayers();
    if (mode !== 'editing') {
      points.forEach(({ lat, lng }) => circleMarker([lat, lng], VERTEX_STYLE).addTo(this.vertices));
    }

    // The total needs a leg to measure; a lone starting point stays unlabeled.
    const last = points.at(-1);
    if (!last || points.length < 2) {
      this.overlay.removeLayer(this.label);
      return;
    }
    this.label.setLatLng([last.lat, last.lng]).setContent(formatDistance(this.totalMeters()));
    if (!this.overlay.hasLayer(this.label)) this.overlay.addLayer(this.label);
  }

  private renderEditing(map: LeafletMap, editing: boolean, points: readonly GeoPoint[]): void {
    const wasEditing = this.path.editEnabled?.() ?? false;
    if (!editing || !wasEditing) {
      this.path.setLatLngs(points.map(({ lat, lng }): [number, number] => [lat, lng]));
    }
    if (editing === wasEditing) return;

    if (editing) {
      ensureEditTools(map);
      map.getContainer().style.setProperty(CSS_VARIABLES.POLYGON_COLOR, EDIT_HANDLE_COLOR);
      this.path.enableEdit(map);
    } else {
      this.path.disableEdit();
      // Polygon editing may have taken the variable over in the meantime; leave theirs.
      const style = map.getContainer().style;
      if (style.getPropertyValue(CSS_VARIABLES.POLYGON_COLOR) === EDIT_HANDLE_COLOR) {
        style.removeProperty(CSS_VARIABLES.POLYGON_COLOR);
      }
    }
  }
}
