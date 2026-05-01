import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PointQueryViewerService } from '../../../../../services/layers/point-query-tools.service';

@Component({
  selector: 'app-point-query-tools-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatTooltipModule],
  templateUrl: './point-query-tools-tab.html',
  styleUrl: './point-query-tools-tab.scss',
})
export class PointQueryToolsTabComponent {
  readonly viewer = inject(PointQueryViewerService);

  onToolEnabledChange(enabled: boolean): void {
    this.viewer.setEnabled(enabled);
  }

  onMarkerChange(enabled: boolean): void {
    this.viewer.toggleMarker(enabled);
  }
}
