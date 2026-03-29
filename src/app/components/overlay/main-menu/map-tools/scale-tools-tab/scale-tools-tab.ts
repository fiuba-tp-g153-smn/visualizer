import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ScaleToolsService } from '../../../../../services/layers/scale-tools.service';

@Component({
  selector: 'app-scale-tools-tab',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule],
  templateUrl: './scale-tools-tab.html',
  styleUrl: './scale-tools-tab.scss',
})
export class ScaleToolsTabComponent {
  readonly scaleTools = inject(ScaleToolsService);

  toggleScaleLayer(layerId: string): void {
    this.scaleTools.toggleLayerSelection(layerId);
  }
}
