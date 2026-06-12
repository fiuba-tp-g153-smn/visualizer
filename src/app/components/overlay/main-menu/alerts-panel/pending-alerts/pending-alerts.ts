import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { PendingAlertsService } from '../../../../../services/active-alerts/pending-alerts.service';
import { PendingAlert } from '../../../../../models/geo';
import { withDepartmentGeometries } from '../../../../../utils/active-alert.utils';
import {
  GifPreviewDialogComponent,
  GifPreviewDialogData,
} from '../../../../floating/gif-preview-dialog/gif-preview-dialog';
import { DepartmentListComponent, DepartmentListItem } from '../department-list/department-list';
import { MapInfoService } from '../../../../../services/layers/map-info.service';
import { AlertListItemComponent, DetailRowConfig } from '../alert-list-item/alert-list-item';
import { DetailItemComponent } from '../../../../shared/detail-item/detail-item';

/**
 * List of pending alerts. Presentation only: the section toggle and refresh
 * controls live in the parent emitted-alerts component.
 */
@Component({
  selector: 'app-pending-alerts',
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
  templateUrl: './pending-alerts.html',
  styleUrl: './pending-alerts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingAlertsComponent {
  private readonly pendingAlertsService = inject(PendingAlertsService);
  private readonly dialog = inject(MatDialog);
  private readonly mapInfoService = inject(MapInfoService);

  readonly pendingAlerts = this.pendingAlertsService.pendingAlerts;
  readonly hiddenIds = this.pendingAlertsService.hiddenIds;

  isHidden(alertId: number): boolean {
    return this.hiddenIds().has(alertId);
  }

  toggleHidden(alertId: number): void {
    this.pendingAlertsService.toggleHidden(alertId);
  }

  flyToAlert(alert: PendingAlert): void {
    this.mapInfoService.flyToCoordinates(alert.coordinates);
  }

  onDepartmentsOpened(alert: PendingAlert): void {
    void this.pendingAlertsService.showDepartments(alert);
  }

  onDepartmentsClosed(alert: PendingAlert): void {
    // Several cards can be expanded at once; only clear the overlay if this
    // alert is the one currently shown on the map.
    if (this.pendingAlertsService.shownDepartmentsAlert()?.alertId === alert.alertId) {
      this.pendingAlertsService.hideDepartments();
    }
  }

  onDepartmentHover(name: string): void {
    this.pendingAlertsService.setHoveredDepartment(name);
  }

  onProvinceHover(names: ReadonlyArray<string>): void {
    this.pendingAlertsService.setHoveredDepartments(names);
  }

  onDepartmentLeave(): void {
    this.pendingAlertsService.clearHoveredDepartment();
  }

  getDepartments(alert: PendingAlert): ReadonlyArray<DepartmentListItem> {
    const shownAlert = this.pendingAlertsService.shownDepartmentsAlert();
    const shownDepartments =
      shownAlert?.alertId === alert.alertId ? this.pendingAlertsService.shownDepartments() : [];
    return withDepartmentGeometries(alert.departments, shownDepartments);
  }

  openAreaGif(alert: PendingAlert): void {
    this.openGif(`Aviso #${alert.alertId} — Área`, alert.gifAreaUrl);
  }

  openGralGif(alert: PendingAlert): void {
    this.openGif(`Aviso #${alert.alertId} — General`, alert.gifGralUrl);
  }

  getDetailRows(alert: PendingAlert): DetailRowConfig[] {
    return [
      {
        icon: 'warning',
        label: 'Fenómeno:',
        value: alert.phenomenon,
        dividerBefore: true,
      },
    ];
  }

  private openGif(title: string, url: string): void {
    this.dialog.open<GifPreviewDialogComponent, GifPreviewDialogData>(GifPreviewDialogComponent, {
      data: { title, url },
      maxWidth: '90vw',
    });
  }
}
