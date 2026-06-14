import { Injectable, effect, inject, signal } from '@angular/core';
import {
  DomEvent,
  FeatureGroup,
  GeoJSON,
  LatLngExpression,
  LeafletMouseEvent,
  Map as LeafletMap,
  featureGroup,
  geoJSON,
  polygon as leafletPolygon,
} from 'leaflet';
import { MatDialog } from '@angular/material/dialog';
import { ActiveAlertsService } from './active-alerts.service';
import { PendingAlertsService } from './pending-alerts.service';
import { ActiveAlert, Department, PendingAlert } from '../../models/geo';
import {
  EmittedAlertContextMenuAction,
  EmittedAlertContextMenuState,
} from '../../models/emitted-alert-context-menu.model';
import {
  ACTIVE_ALERT_COLOR,
  ACTIVE_ALERT_POLYGON_OPTIONS,
  PENDING_ALERT_COLOR,
  PENDING_ALERT_POLYGON_OPTIONS,
} from '../../config/map-active-alerts.config';
import { DEPARTMENT_STYLE, Z_INDEX } from '../../config/map-polygons.config';
import { ACTION_DELAYS } from '../../config/timing.config';
import { MAP_PANES } from '../../constants/map-polygons.constants';
import { createDepartmentStyle, lightenColor } from '../../utils/map-styles.utils';
import { activeAlertColorForExpiry } from '../../utils/active-alert.utils';
import {
  GifPreviewDialogComponent,
  GifPreviewDialogData,
} from '../../components/floating/gif-preview-dialog/gif-preview-dialog';

/** Normalizes a department name for matching (lowercase, trimmed, accent-free). */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .trim()
    .toLowerCase();
}

/**
 * Renders active and pending alert polygons on the map in dedicated layer
 * groups, plus the affected departments of the alert whose list is currently
 * open, with hover highlighting. Read-only overlays, separate from the
 * editable user polygons. Also owns the right-click context menu for emitted
 * alert polygons.
 */
@Injectable({ providedIn: 'root' })
export class ActiveAlertsMapService {
  private readonly activeAlertsService = inject(ActiveAlertsService);
  private readonly pendingAlertsService = inject(PendingAlertsService);
  private readonly dialog = inject(MatDialog);

  private map: LeafletMap | null = null;
  private readonly layerGroup: FeatureGroup = featureGroup();
  private readonly pendingLayerGroup: FeatureGroup = featureGroup();

  private readonly contextMenuStateSignal = signal<EmittedAlertContextMenuState | null>(null);
  readonly contextMenuState = this.contextMenuStateSignal.asReadonly();

  // Lightened version of the shown alert's expiry color; updated on render.
  private departmentColor = lightenColor(ACTIVE_ALERT_COLOR, DEPARTMENT_STYLE.LIGHTEN_PERCENT);
  private readonly departmentLayers = new Map<string, GeoJSON>(); // normalized name -> layer

  constructor() {
    effect(() => {
      const show = this.activeAlertsService.showActive();
      const alerts = this.activeAlertsService.activeAlerts();
      const hiddenIds = this.activeAlertsService.hiddenIds();
      if (!this.map) return;
      if (show) {
        this.render(alerts, hiddenIds);
      } else {
        this.layerGroup.clearLayers();
      }
    });

    effect(() => {
      const show = this.pendingAlertsService.showPending();
      const alerts = this.pendingAlertsService.pendingAlerts();
      const hiddenIds = this.pendingAlertsService.hiddenIds();
      if (!this.map) return;
      if (show) {
        this.renderPending(alerts, hiddenIds);
      } else {
        this.pendingLayerGroup.clearLayers();
      }
    });

    // Departments overlay: at most one departments list is open at a time
    // (active or pending), so exactly one source is non-empty.
    effect(() => {
      const activeDepartments = this.activeAlertsService.shownDepartments();
      const activeAlert = this.activeAlertsService.shownDepartmentsAlert();
      const pendingDepartments = this.pendingAlertsService.shownDepartments();
      const pendingAlert = this.pendingAlertsService.shownDepartmentsAlert();
      if (!this.map) return;

      if (pendingAlert) {
        this.departmentColor = lightenColor(PENDING_ALERT_COLOR, DEPARTMENT_STYLE.LIGHTEN_PERCENT);
        this.renderDepartments(pendingDepartments);
      } else {
        if (activeAlert) {
          this.departmentColor = lightenColor(
            activeAlertColorForExpiry(activeAlert.endDatetime),
            DEPARTMENT_STYLE.LIGHTEN_PERCENT,
          );
        }
        this.renderDepartments(activeDepartments);
      }
    });

    effect(() => {
      const activeHovered = this.activeAlertsService.hoveredDepartments();
      const pendingHovered = this.pendingAlertsService.hoveredDepartments();
      const hovered = activeHovered.length > 0 ? activeHovered : pendingHovered;
      if (!this.map) return;
      this.updateDepartmentHighlight(hovered);
    });
  }

  /** Wire the service to the Leaflet map instance (called from MapContainer). */
  initialize(map: LeafletMap): void {
    this.map = map;
    this.layerGroup.addTo(map);
    this.pendingLayerGroup.addTo(map);
  }

  closeContextMenu(): void {
    this.contextMenuStateSignal.set(null);
  }

  handleContextMenuAction(action: EmittedAlertContextMenuAction): void {
    const state = this.contextMenuStateSignal();
    this.closeContextMenu();

    // Without a delay the menu DOM is still visible when the action runs,
    // which can interfere with dialogs and focus management.
    setTimeout(() => {
      switch (action.type) {
        case 'toggleVisibility':
          if (action.kind === 'pending') {
            this.pendingAlertsService.toggleHidden(action.alertId);
          } else {
            this.activeAlertsService.toggleHidden(action.alertId);
          }
          break;

        case 'toggleDepartments':
          this.toggleDepartments(action);
          break;

        case 'viewGifArea':
          if (state?.gifAreaUrl) {
            this.openGif(`Aviso #${action.alertId} — Área`, state.gifAreaUrl);
          }
          break;

        case 'viewGifGral':
          if (state?.gifGralUrl) {
            this.openGif(`Aviso #${action.alertId} — General`, state.gifGralUrl);
          }
          break;
      }
    }, ACTION_DELAYS.MENU_ACTION);
  }

  private toggleDepartments(action: EmittedAlertContextMenuAction): void {
    if (action.kind === 'pending') {
      const shown = this.pendingAlertsService.shownDepartmentsAlert();
      if (shown?.alertId === action.alertId) {
        this.pendingAlertsService.hideDepartments();
        return;
      }
      const alert = this.pendingAlertsService
        .pendingAlerts()
        .find((a) => a.alertId === action.alertId);
      if (!alert) return;
      this.activeAlertsService.hideDepartments();
      void this.pendingAlertsService.showDepartments(alert);
    } else {
      const shown = this.activeAlertsService.shownDepartmentsAlert();
      if (shown?.alertId === action.alertId) {
        this.activeAlertsService.hideDepartments();
        return;
      }
      const alert = this.activeAlertsService
        .activeAlerts()
        .find((a) => a.alertId === action.alertId);
      if (!alert) return;
      this.pendingAlertsService.hideDepartments();
      void this.activeAlertsService.showDepartments(alert);
    }
  }

  private openGif(title: string, url: string): void {
    this.dialog.open<GifPreviewDialogComponent, GifPreviewDialogData>(GifPreviewDialogComponent, {
      data: { title, url },
      maxWidth: '90vw',
    });
  }

  private openContextMenuForActive(alert: ActiveAlert, event: LeafletMouseEvent): void {
    this.contextMenuStateSignal.set({
      x: event.containerPoint.x,
      y: event.containerPoint.y,
      kind: 'active',
      alertId: alert.alertId,
      hidden: this.activeAlertsService.hiddenIds().has(alert.alertId),
      departmentsShown: this.activeAlertsService.shownDepartmentsAlert()?.alertId === alert.alertId,
      phenomenon: alert.phenomenon,
      startDatetime: alert.startDatetime,
      endDatetime: alert.endDatetime,
    });
  }

  private openContextMenuForPending(alert: PendingAlert, event: LeafletMouseEvent): void {
    this.contextMenuStateSignal.set({
      x: event.containerPoint.x,
      y: event.containerPoint.y,
      kind: 'pending',
      alertId: alert.alertId,
      hidden: this.pendingAlertsService.hiddenIds().has(alert.alertId),
      departmentsShown:
        this.pendingAlertsService.shownDepartmentsAlert()?.alertId === alert.alertId,
      phenomenon: alert.phenomenon,
      gifAreaUrl: alert.gifAreaUrl,
      gifGralUrl: alert.gifGralUrl,
    });
  }

  private render(alerts: ReadonlyArray<ActiveAlert>, hiddenIds: ReadonlySet<number>): void {
    this.layerGroup.clearLayers();

    const now = Date.now();
    for (const alert of alerts) {
      if (hiddenIds.has(alert.alertId)) continue; // hidden by the user
      if (alert.coordinates.length < 3) continue; // not a drawable polygon

      const latlngs = alert.coordinates.map(([lat, lng]) => [lat, lng] as LatLngExpression);
      // Color reflects time left until expiry (green → yellow → red).
      const color = activeAlertColorForExpiry(alert.endDatetime, now);
      const polygon = leafletPolygon(latlngs, {
        ...ACTIVE_ALERT_POLYGON_OPTIONS,
        color,
        fillColor: color,
      });
      polygon.on('contextmenu', (e: LeafletMouseEvent) => {
        DomEvent.stop(e.originalEvent);
        this.openContextMenuForActive(alert, e);
      });
      this.layerGroup.addLayer(polygon);
    }
  }

  private renderPending(alerts: ReadonlyArray<PendingAlert>, hiddenIds: ReadonlySet<number>): void {
    this.pendingLayerGroup.clearLayers();

    for (const alert of alerts) {
      if (hiddenIds.has(alert.alertId)) continue;
      if (alert.coordinates.length < 3) continue;

      const latlngs = alert.coordinates.map(([lat, lng]) => [lat, lng] as LatLngExpression);
      const polygon = leafletPolygon(latlngs, PENDING_ALERT_POLYGON_OPTIONS);
      polygon.on('contextmenu', (e: LeafletMouseEvent) => {
        DomEvent.stop(e.originalEvent);
        this.openContextMenuForPending(alert, e);
      });
      this.pendingLayerGroup.addLayer(polygon);
    }
  }

  private renderDepartments(departments: ReadonlyArray<Department>): void {
    this.clearDepartments();
    if (!this.map || departments.length === 0) return;

    if (!this.map.getPane(MAP_PANES.DEPARTMENTS)) {
      const pane = this.map.createPane(MAP_PANES.DEPARTMENTS);
      pane.style.zIndex = String(Z_INDEX.DEPARTMENTS);
      pane.style.pointerEvents = 'none';
    }

    for (const dept of departments) {
      const layer = geoJSON(dept.geometry as GeoJSON.GeoJsonObject, {
        pane: MAP_PANES.DEPARTMENTS,
        interactive: false,
        style: createDepartmentStyle(this.departmentColor),
      });
      const tooltip = dept.province ? `${dept.name} (${dept.province})` : dept.name;
      layer.bindTooltip(tooltip, { direction: 'center', className: 'department-tooltip' });
      layer.addTo(this.map);
      this.departmentLayers.set(normalizeName(dept.name), layer);
    }
  }

  private clearDepartments(): void {
    this.departmentLayers.forEach((layer) => layer.remove());
    this.departmentLayers.clear();
  }

  private updateDepartmentHighlight(hovered: ReadonlyArray<string>): void {
    const base = createDepartmentStyle(this.departmentColor);
    this.departmentLayers.forEach((layer) => layer.setStyle(base));

    for (const name of hovered) {
      const target = this.departmentLayers.get(normalizeName(name));
      if (!target) continue;

      target.setStyle({
        ...base,
        fillOpacity: DEPARTMENT_STYLE.FILL_OPACITY * 2.5,
        opacity: DEPARTMENT_STYLE.OPACITY * 1.5,
        weight: DEPARTMENT_STYLE.WEIGHT * 1.5,
      });
      target.bringToFront();
    }
  }

}
