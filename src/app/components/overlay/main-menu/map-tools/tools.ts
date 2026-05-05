import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { PointQueryViewerService } from '../../../../services/layers/point-query-tools.service';
import { ScaleToolsService } from '../../../../services/layers/scale-tools.service';
import { MenuPanelComponent } from '../menu-section.model';
import { PointQueryToolsTabComponent } from './point-query-tools-tab/point-query-tools-tab';
import { ScaleToolsTabComponent } from './scale-tools-tab/scale-tools-tab';
import { GeneralToolsTabComponent } from './general-tools-tab/general-tools-tab';

@Component({
  selector: 'app-map-tools',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    ScaleToolsTabComponent,
    PointQueryToolsTabComponent,
    GeneralToolsTabComponent,
  ],
  templateUrl: './tools.html',
  styleUrl: './tools.scss',
})
export class MapToolsComponent implements MenuPanelComponent {
  private readonly viewer = inject(PointQueryViewerService);
  private readonly scaleTools = inject(ScaleToolsService);

  getScaleItemsCount(): number {
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
