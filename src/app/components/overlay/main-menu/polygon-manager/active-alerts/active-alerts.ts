import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { ActiveAlertsService } from '../../../../../services/active-alerts/active-alerts.service';
import { ActiveAlert } from '../../../../../models/geo';
import { formatDateTimeLocalized } from '../../../../../utils/tileset-timestamp';

/**
 * "Activas" tab content: toggle to show active alerts, a manual refresh button
 * and the list of active alerts.
 */
@Component({
  selector: 'app-active-alerts',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './active-alerts.html',
  styleUrl: './active-alerts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveAlertsComponent {
  private readonly activeAlertsService = inject(ActiveAlertsService);

  readonly showActive = this.activeAlertsService.showActive;
  readonly activeAlerts = this.activeAlertsService.activeAlerts;
  readonly loading = this.activeAlertsService.loading;

  onToggle(checked: boolean): void {
    this.activeAlertsService.setShowActive(checked);
  }

  refresh(): void {
    void this.activeAlertsService.refresh();
  }

  onDepartmentsOpened(alert: ActiveAlert): void {
    void this.activeAlertsService.showDepartments(alert);
  }

  onDepartmentsClosed(): void {
    this.activeAlertsService.hideDepartments();
  }

  onDepartmentHover(name: string): void {
    this.activeAlertsService.setHoveredDepartment(name);
  }

  onDepartmentLeave(): void {
    this.activeAlertsService.clearHoveredDepartment();
  }

  formatDate(date: Date): string {
    return formatDateTimeLocalized(date);
  }
}
