import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner';
import { ActiveAlertsService } from '../../../../../services/active-alerts/active-alerts.service';
import { PendingAlertsService } from '../../../../../services/active-alerts/pending-alerts.service';
import { LocalStorageService } from '../../../../../services/storage/local-storage.service';
import { STORAGE_KEYS } from '../../../../../constants';
import { ActiveAlertsComponent } from '../active-alerts/active-alerts';
import { PendingAlertsComponent } from '../pending-alerts/pending-alerts';

interface PersistedEmittedAlertsSections {
  readonly pendingExpanded: boolean;
  readonly activeExpanded: boolean;
}

/**
 * Emitidos tab: a "Pendientes" section (emitted but not yet processed by the
 * backend) and an "Activos" section. Each section has its own on/off toggle
 * (emitting an alert turns Pendientes on automatically) and can be collapsed
 * independently.
 */
@Component({
  selector: 'app-emitted-alerts',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    LoadingSpinnerComponent,
    ActiveAlertsComponent,
    PendingAlertsComponent,
  ],
  templateUrl: './emitted-alerts.html',
  styleUrl: './emitted-alerts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmittedAlertsComponent {
  private readonly activeAlertsService = inject(ActiveAlertsService);
  private readonly pendingAlertsService = inject(PendingAlertsService);
  private readonly storage = inject(LocalStorageService);

  readonly showPending = this.pendingAlertsService.showPending;
  readonly pendingAlerts = this.pendingAlertsService.pendingAlerts;
  readonly pendingLoading = this.pendingAlertsService.loading;

  readonly showActive = this.activeAlertsService.showActive;
  readonly activeAlerts = this.activeAlertsService.activeAlerts;
  readonly activeLoading = this.activeAlertsService.loading;

  private readonly persistedSections = this.storage.getJson<PersistedEmittedAlertsSections>(
    STORAGE_KEYS.EMITTED_ALERTS_SECTIONS,
  );

  readonly pendingExpanded = signal<boolean>(this.persistedSections?.pendingExpanded ?? true);
  readonly activeExpanded = signal<boolean>(this.persistedSections?.activeExpanded ?? true);

  constructor() {
    effect(() => {
      this.storage.setJson<PersistedEmittedAlertsSections>(STORAGE_KEYS.EMITTED_ALERTS_SECTIONS, {
        pendingExpanded: this.pendingExpanded(),
        activeExpanded: this.activeExpanded(),
      });
    });
  }

  onTogglePending(on: boolean): void {
    this.pendingAlertsService.setShowPending(on);
    if (on) {
      this.pendingExpanded.set(true);
    }
  }

  onToggleActive(on: boolean): void {
    this.activeAlertsService.setShowActive(on);
    if (on) {
      this.activeExpanded.set(true);
    }
  }

  togglePendingExpanded(): void {
    this.pendingExpanded.set(!this.pendingExpanded());
  }

  toggleActiveExpanded(): void {
    this.activeExpanded.set(!this.activeExpanded());
  }

  refreshPending(): void {
    void this.pendingAlertsService.refresh();
  }

  refreshActive(): void {
    void this.activeAlertsService.refresh();
  }
}
