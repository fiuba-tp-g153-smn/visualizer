import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  POINT_QUERY_PANEL_MODES,
  PointQueryPanelMode,
  PointQueryViewerService,
} from '../../../../../services/tools/point-query-viewer.service';

@Component({
  selector: 'app-point-query-viewer-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatRadioModule, MatTooltipModule],
  templateUrl: './point-query-viewer-tab.html',
  styleUrl: './point-query-viewer-tab.scss',
})
export class PointQueryViewerTabComponent {
  readonly viewer = inject(PointQueryViewerService);
  readonly panelModes = POINT_QUERY_PANEL_MODES;

  onToolEnabledChange(enabled: boolean): void {
    this.viewer.setEnabled(enabled);
  }

  onMarkerChange(enabled: boolean): void {
    this.viewer.toggleMarker(enabled);
  }

  onPanelModeChange(mode: PointQueryPanelMode): void {
    this.viewer.setPanelMode(mode);
  }
}
