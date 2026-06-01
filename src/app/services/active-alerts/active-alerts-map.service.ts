import { Injectable, effect, inject } from '@angular/core';
import * as L from 'leaflet';
import { ActiveAlertsService } from './active-alerts.service';
import { ActiveAlert, Department } from '../../models/geo';
import {
  ACTIVE_ALERT_COLOR,
  ACTIVE_ALERT_POLYGON_OPTIONS,
} from '../../config/map-active-alerts.config';
import { DEPARTMENT_STYLE, Z_INDEX } from '../../config/map-polygons.config';
import { MAP_PANES } from '../../constants/map-polygons.constants';
import { createDepartmentStyle, lightenColor } from '../../utils/map-styles.utils';
import { activeAlertColorForExpiry } from '../../utils/active-alert.utils';
import { formatDateTimeLocalized } from '../../utils/tileset-timestamp';

/** Normalizes a department name for matching (lowercase, trimmed, accent-free). */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .trim()
    .toLowerCase();
}

/**
 * Renders active alert polygons on the map in a dedicated layer group, plus the
 * affected departments of the alert whose list is currently open, with hover
 * highlighting. Read-only overlay, separate from the editable user polygons.
 */
@Injectable({ providedIn: 'root' })
export class ActiveAlertsMapService {
  private readonly activeAlertsService = inject(ActiveAlertsService);

  private map: L.Map | null = null;
  private readonly layerGroup: L.FeatureGroup = L.featureGroup();

  // Lightened version of the shown alert's expiry color; updated on render.
  private departmentColor = lightenColor(ACTIVE_ALERT_COLOR, DEPARTMENT_STYLE.LIGHTEN_PERCENT);
  private readonly departmentLayers = new Map<string, L.GeoJSON>(); // normalized name -> layer

  constructor() {
    effect(() => {
      const show = this.activeAlertsService.showActive();
      const alerts = this.activeAlertsService.activeAlerts();
      if (!this.map) return;
      if (show) {
        this.render(alerts);
      } else {
        this.clear();
      }
    });

    effect(() => {
      const departments = this.activeAlertsService.shownDepartments();
      const alert = this.activeAlertsService.shownDepartmentsAlert();
      if (!this.map) return;
      if (alert) {
        this.departmentColor = lightenColor(
          activeAlertColorForExpiry(alert.endDatetime),
          DEPARTMENT_STYLE.LIGHTEN_PERCENT,
        );
      }
      this.renderDepartments(departments);
    });

    effect(() => {
      const hovered = this.activeAlertsService.hoveredDepartment();
      if (!this.map) return;
      this.updateDepartmentHighlight(hovered);
    });
  }

  /** Wire the service to the Leaflet map instance (called from MapContainer). */
  initialize(map: L.Map): void {
    this.map = map;
    this.layerGroup.addTo(map);
  }

  private render(alerts: ReadonlyArray<ActiveAlert>): void {
    this.layerGroup.clearLayers();

    const now = Date.now();
    for (const alert of alerts) {
      if (alert.coordinates.length < 3) continue; // not a drawable polygon

      const latlngs = alert.coordinates.map(([lat, lng]) => [lat, lng] as L.LatLngExpression);
      // Color reflects time left until expiry (green → yellow → red).
      const color = activeAlertColorForExpiry(alert.endDatetime, now);
      const polygon = L.polygon(latlngs, {
        ...ACTIVE_ALERT_POLYGON_OPTIONS,
        color,
        fillColor: color,
      });
      polygon.bindPopup(this.buildPopup(alert));
      this.layerGroup.addLayer(polygon);
    }
  }

  private clear(): void {
    this.layerGroup.clearLayers();
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
      const layer = L.geoJSON(dept.geometry as GeoJSON.GeoJsonObject, {
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

  private updateDepartmentHighlight(hovered: string | null): void {
    const base = createDepartmentStyle(this.departmentColor);
    this.departmentLayers.forEach((layer) => layer.setStyle(base));

    if (!hovered) return;
    const target = this.departmentLayers.get(normalizeName(hovered));
    if (!target) return;

    target.setStyle({
      ...base,
      fillOpacity: DEPARTMENT_STYLE.FILL_OPACITY * 2.5,
      opacity: DEPARTMENT_STYLE.OPACITY * 1.5,
      weight: DEPARTMENT_STYLE.WEIGHT * 1.5,
    });
    target.bringToFront();
  }

  private buildPopup(alert: ActiveAlert): string {
    const start = formatDateTimeLocalized(alert.startDatetime);
    const end = formatDateTimeLocalized(alert.endDatetime);
    return `
      <strong>Aviso #${alert.alertId}</strong><br />
      ${alert.phenomenon}<br />
      Inicio: ${start}<br />
      Fin: ${end}
    `;
  }
}
