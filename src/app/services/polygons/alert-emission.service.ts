import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PolygonService } from './polygon.service';
import { PendingAlertsService } from '../active-alerts/pending-alerts.service';
import { PhenomenonSelectionDialogComponent } from '../../components/floating/phenomenon-selection-dialog/phenomenon-selection-dialog';
import { SidebarMenuService } from '../../components/overlay/main-menu/sidebar-menu.service';
import { AlertsPanelStateService } from '../../components/overlay/main-menu/alerts-panel/alerts-panel-state.service';

const ALERTS_PANEL_ID = 'alerts';

/**
 * Shared emission flow (phenomenon dialog → POST /alerts → pending list), so
 * both the panel button and the map context menu behave identically: the draft
 * is deleted, the Pendientes section turns on, and the panel jumps to the
 * Emitidos tab.
 */
@Injectable({ providedIn: 'root' })
export class AlertEmissionService {
  private readonly polygonService = inject(PolygonService);
  private readonly pendingAlertsService = inject(PendingAlertsService);
  private readonly sidebarMenuService = inject(SidebarMenuService);
  private readonly panelState = inject(AlertsPanelStateService);
  private readonly dialog = inject(MatDialog);

  async emitAlert(polygonId: string): Promise<void> {
    if (this.polygonService.isAlertsLoading(polygonId)) return;

    const dialogRef = this.dialog.open<PhenomenonSelectionDialogComponent, void, number | null>(
      PhenomenonSelectionDialogComponent,
      { width: '500px' },
    );

    const selectedCode = await firstValueFrom(dialogRef.afterClosed());
    if (selectedCode === null || selectedCode === undefined) return;

    const pendingAlert = await this.polygonService.generateAlerts(polygonId, selectedCode);
    if (!pendingAlert) {
      console.error('Error al generar alertas');
      return;
    }

    // The draft was deleted; the alert is now backend-owned and shows up in
    // the Pendientes section right away.
    this.pendingAlertsService.addEmitted(pendingAlert);
    this.panelState.openEmittedTab();
    if (this.sidebarMenuService.activePanel() !== ALERTS_PANEL_ID) {
      this.sidebarMenuService.togglePanel(ALERTS_PANEL_ID);
    }
  }
}
