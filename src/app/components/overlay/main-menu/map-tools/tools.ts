import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { PointQueryViewerService } from '../../../../services/tools/point-query-viewer.service';
import { ScaleToolsService } from '../../../../services/tools/scale-tools.service';
import { MenuPanelComponent } from '../menu-section.model';
import { PointQueryViewerTabComponent } from './point-query-viewer-tab/point-query-viewer-tab';
import { ScaleTabComponent } from './scale-tab/scale-tab';
import { GeneralTabComponent } from './general-tab/general-tab';

@Component({
  selector: 'app-map-tools',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    ScaleTabComponent,
    PointQueryViewerTabComponent,
    GeneralTabComponent,
  ],
  templateUrl: './tools.html',
  styleUrl: './tools.scss',
})
export class MapToolsComponent implements MenuPanelComponent {
  private readonly viewer = inject(PointQueryViewerService);
  private readonly scaleTools = inject(ScaleToolsService);

  getScaleItemsCount(): number {
    if (!this.scaleTools.enabled()) {
      return 0;
    }

    return this.scaleTools.selectedLayerIdsOrdered().length;
  }

  getPointSelectedCount(): number {
    if (!this.viewer.enabled()) {
      return 0;
    }

    return this.viewer.selectedLayerIdsOrdered().length;
  }

  onPanelOpen(): void {}

  onPanelClose(): void {}
}
