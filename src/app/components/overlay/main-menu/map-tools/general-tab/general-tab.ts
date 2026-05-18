import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MapInfoService } from '../../../../../services/layers/map-info.service';

@Component({
  selector: 'app-general-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatTooltipModule],
  templateUrl: './general-tab.html',
  styleUrl: './general-tab.scss',
})
export class GeneralTabComponent {
  readonly mapInfo = inject(MapInfoService);

  onCoordinatesChange(enabled: boolean): void {
    this.mapInfo.toggleCoordinates(enabled);
    // When disabling coordinates, also disable cursor lines
    if (!enabled) {
      this.mapInfo.toggleCursorLines(false);
    }
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

  onCursorLinesChange(enabled: boolean): void {
    this.mapInfo.toggleCursorLines(enabled);
  }

  onGraticuleChange(enabled: boolean): void {
    this.mapInfo.toggleGraticule(enabled);
  }
}
