import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ScaleToolsService } from '../../../../../services/tools/scale-tools.service';

@Component({
  selector: 'app-scale-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule],
  templateUrl: './scale-tab.html',
  styleUrl: './scale-tab.scss',
})
export class ScaleTabComponent {
  readonly scaleTools = inject(ScaleToolsService);

  onToolEnabledChange(enabled: boolean): void {
    this.scaleTools.setEnabled(enabled);
  }

  toggleScaleLayer(layerId: string): void {
    this.scaleTools.toggleLayerSelection(layerId);
  }
}
