import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { ActiveAlertsService } from '../../../../../services/active-alerts/active-alerts.service';
import { ActiveAlert } from '../../../../../models/geo';
import { formatDateTimeLocalized } from '../../../../../utils/tileset-timestamp';
import {
  activeAlertColorForExpiry,
  formatActiveAlertRemaining,
  withDepartmentGeometries,
} from '../../../../../utils/active-alert.utils';
import { DepartmentListComponent, DepartmentListItem } from '../department-list/department-list';
import { AlertListItemComponent, DetailRowConfig } from '../alert-list-item/alert-list-item';
import { DetailItemComponent } from '../../../../shared/detail-item/detail-item';
import { MapInfoService } from '../../../../../services/layers/map-info.service';

/**
 * List of active alerts. Presentation only: the section toggle and refresh
 * controls live in the parent emitted-alerts component.
 */
@Component({
  selector: 'app-active-alerts',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    DepartmentListComponent,
    AlertListItemComponent,
    DetailItemComponent,
  ],
  templateUrl: './active-alerts.html',
  styleUrl: './active-alerts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveAlertsComponent {
  private readonly activeAlertsService = inject(ActiveAlertsService);
  private readonly mapInfoService = inject(MapInfoService);

  readonly activeAlerts = this.activeAlertsService.activeAlerts;
  readonly hiddenIds = this.activeAlertsService.hiddenIds;

  isHidden(alertId: number): boolean {
    return this.hiddenIds().has(alertId);
  }

  toggleHidden(alertId: number): void {
    this.activeAlertsService.toggleHidden(alertId);
  }

  flyToAlert(alert: ActiveAlert): void {
    this.mapInfoService.flyToCoordinates(alert.coordinates);
  }

  onDepartmentsOpened(alert: ActiveAlert): void {
    void this.activeAlertsService.showDepartments(alert);
  }

  onDepartmentsClosed(alert: ActiveAlert): void {
    // Several items can be expanded at once; only clear the overlay if this
    // alert is the one currently shown on the map.
    if (this.activeAlertsService.shownDepartmentsAlert()?.alertId === alert.alertId) {
      this.activeAlertsService.hideDepartments();
    }
  }

  onDepartmentHover(name: string): void {
    this.activeAlertsService.setHoveredDepartment(name);
  }

  onProvinceHover(names: ReadonlyArray<string>): void {
    this.activeAlertsService.setHoveredDepartments(names);
  }

  onDepartmentLeave(): void {
    this.activeAlertsService.clearHoveredDepartment();
  }

  getDepartments(alert: ActiveAlert): ReadonlyArray<DepartmentListItem> {
    const shownAlert = this.activeAlertsService.shownDepartmentsAlert();
    const shownDepartments =
      shownAlert?.alertId === alert.alertId ? this.activeAlertsService.shownDepartments() : [];
    return withDepartmentGeometries(alert.departments, shownDepartments);
  }

  formatDate(date: Date): string {
    return formatDateTimeLocalized(date);
  }

  remaining(alert: ActiveAlert): string {
    return formatActiveAlertRemaining(alert.endDatetime);
  }

  expiryColor(alert: ActiveAlert): string {
    return activeAlertColorForExpiry(alert.endDatetime);
  }

  getDetailRows(alert: ActiveAlert): DetailRowConfig[] {
    return [
      {
        icon: 'warning',
        label: 'Fenómeno:',
        value: alert.phenomenon,
        dividerBefore: true,
      },
      { icon: 'schedule', label: 'Emisión:', value: this.formatDate(alert.startDatetime) },
      { icon: 'event_busy', label: 'Cese:', value: this.formatDate(alert.endDatetime) },
      {
        icon: 'hourglass_bottom',
        label: 'Tiempo restante:',
        value: this.remaining(alert),
        valueClass: 'remaining',
        valueColor: this.expiryColor(alert),
      },
    ];
  }
}
