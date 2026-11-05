import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ScaleToolsService } from '../../../../../services/tools/scale-tools.service';
import { MAP_TEXTS } from '../../../../../texts';

@Component({
  selector: 'app-scale-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatTooltipModule],
  templateUrl: './scale-tab.html',
  styleUrl: './scale-tab.scss',
})
export class ScaleTabComponent {
  protected readonly t = MAP_TEXTS.tools;
  readonly scaleTools = inject(ScaleToolsService);

  onToolEnabledChange(enabled: boolean): void {
    this.scaleTools.setEnabled(enabled);
  }

  toggleScaleLayer(layerId: string): void {
    this.scaleTools.toggleLayerSelection(layerId);
  }
}
