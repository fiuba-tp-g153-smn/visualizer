import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PolygonService } from './polygon.service';
import { ALERT_JOB_ERROR_CODE, AlertJobStatus } from './department-intersection.service';
import { PendingAlertsService } from '../active-alerts/pending-alerts.service';
import { AlertJobService, JOB_DONE, JOB_TIMEOUT } from '../active-alerts/alert-job.service';
import { NotificationService } from '../notifications/notification.service';
import { PhenomenonSelectionDialogComponent } from '../../components/floating/phenomenon-selection-dialog/phenomenon-selection-dialog';
import { SidebarMenuService } from '../../components/overlay/main-menu/sidebar-menu.service';
import { AlertsPanelStateService } from '../../components/overlay/main-menu/alerts-panel/alerts-panel-state.service';
import { ALERTS_TEXTS } from '../../texts';

const ALERTS_PANEL_ID = 'alerts';

const AREA_TOO_LARGE_MESSAGE = ALERTS_TEXTS.emission.areaTooLarge;
// Client gave up waiting; the alert may still be generating in the background.
const CLIENT_TIMEOUT_MESSAGE = ALERTS_TEXTS.emission.clientTimeout;
// Backend cancelled the job for exceeding its time limit; nothing was produced.
const BACKEND_TIMEOUT_MESSAGE = ALERTS_TEXTS.emission.backendTimeout;
const GENERIC_FAILURE_MESSAGE = ALERTS_TEXTS.emission.genericFailure;

/**
 * Shared emission flow (phenomenon dialog → POST /alerts → background job),
 * used by both the panel button and the map context menu. Generation is
 * asynchronous: POST returns a job id, the draft is kept (marked as submitting)
 * while the job runs, and on success it is deleted and the Pendientes section
 * is refreshed; on failure the draft is kept and the user is told why. Jobs
 * still running when the page reloads are resumed instead of re-submitted.
 */
@Injectable({ providedIn: 'root' })
export class AlertEmissionService {
  private readonly polygonService = inject(PolygonService);
  private readonly pendingAlertsService = inject(PendingAlertsService);
  private readonly alertJobService = inject(AlertJobService);
  private readonly notifications = inject(NotificationService);
  private readonly sidebarMenuService = inject(SidebarMenuService);
  private readonly panelState = inject(AlertsPanelStateService);
  private readonly dialog = inject(MatDialog);

  constructor() {
    // Drafts whose job survived a page reload: resume polling instead of
    // re-submitting, which would create a duplicate alert.
    for (const { id, jobId } of this.polygonService.getResumableJobs()) {
      void this.followJob(id, jobId);
    }
  }

  async emitAlert(polygonId: string): Promise<void> {
    if (this.polygonService.isAlertsLoading(polygonId)) return;

    const dialogRef = this.dialog.open<PhenomenonSelectionDialogComponent, void, number | null>(
      PhenomenonSelectionDialogComponent,
      { width: '500px' },
    );

    const selectedCode = await firstValueFrom(dialogRef.afterClosed());
    if (selectedCode === null || selectedCode === undefined) return;

    // Returns null on a synchronous failure (invalid/oversized polygon), which
    // PolygonService already surfaced to the user.
    const accepted = await this.polygonService.generateAlerts(polygonId, selectedCode);
    if (!accepted) return;

    await this.followJob(polygonId, accepted.job_id);
  }

  private async followJob(polygonId: string, jobId: string): Promise<void> {
    const status = await this.alertJobService.poll(jobId);

    if (status.status === JOB_DONE) {
      this.handleSuccess(polygonId);
      return;
    }
    this.polygonService.cancelEmission(polygonId);
    this.notifications.error(this.failureMessage(status));
  }

  private handleSuccess(polygonId: string): void {
    // The draft is now backend-owned; drop it and pull the fresh pending list.
    this.polygonService.finishEmission(polygonId);
    void this.pendingAlertsService.refreshNow();
    this.panelState.openEmittedTab();
    if (this.sidebarMenuService.activePanel() !== ALERTS_PANEL_ID) {
      this.sidebarMenuService.togglePanel(ALERTS_PANEL_ID);
    }
  }

  private failureMessage(status: AlertJobStatus): string {
    if (status.status === JOB_TIMEOUT) return CLIENT_TIMEOUT_MESSAGE;
    if (status.error_code === ALERT_JOB_ERROR_CODE.AREA_TOO_LARGE) return AREA_TOO_LARGE_MESSAGE;
    if (status.error_code === ALERT_JOB_ERROR_CODE.TIMEOUT) return BACKEND_TIMEOUT_MESSAGE;
    return GENERIC_FAILURE_MESSAGE;
  }
}
