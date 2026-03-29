import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MapInfoService } from '../../../../../services/layers/map-info.service';

@Component({
  selector: 'app-general-tools-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatTooltipModule],
  templateUrl: './general-tools-tab.html',
  styleUrl: './general-tools-tab.scss',
})
export class GeneralToolsTabComponent {
  readonly mapInfo = inject(MapInfoService);

  onCoordinatesChange(enabled: boolean): void {
    this.mapInfo.toggleCoordinates(enabled);
  }

  onScaleChange(enabled: boolean): void {
    this.mapInfo.toggleScale(enabled);
  }

  onZoomChange(enabled: boolean): void {
    this.mapInfo.toggleZoom(enabled);
  }

  onAttributionChange(enabled: boolean): void {
    this.mapInfo.toggleAttribution(enabled);
  }
}
