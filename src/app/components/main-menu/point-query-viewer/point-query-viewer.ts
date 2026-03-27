import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { PointQueryInteractionMode } from '../../../models';
import { PointQueryViewerService } from '../../../services/layers/point-query-tools.service';
import { ScaleToolsService } from '../../../services/layers/scale-tools.service';
import { MenuPanelComponent } from '../menu-section.model';

@Component({
  selector: 'app-point-query-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatCheckboxModule,
    MatRadioModule,
    MatTooltipModule,
    MatTabsModule,
    MatIconModule,
  ],
  templateUrl: './point-query-viewer.html',
  styleUrl: './point-query-viewer.scss',
})
export class PointQueryViewerComponent implements MenuPanelComponent {
  readonly viewer = inject(PointQueryViewerService);
  readonly scaleTools = inject(ScaleToolsService);
  readonly PointQueryInteractionMode = PointQueryInteractionMode;

  readonly interactionModeOptions: Array<{
    value: PointQueryInteractionMode;
    label: string;
    tooltip: string;
  }> = [
    {
      value: PointQueryInteractionMode.OFF,
      label: 'Desactivado',
      tooltip: 'No mostrar visores de datos puntuales',
    },
    {
      value: PointQueryInteractionMode.MANUAL,
      label: 'Manual',
      tooltip: 'Mostrar datos al hacer clic en el mapa',
    },
    {
      value: PointQueryInteractionMode.AUTOMATIC,
      label: 'Automático',
      tooltip: 'Mostrar datos al mover el cursor sobre el mapa',
    },
  ];

  onPanelOpen(): void {}

  onPanelClose(): void {}

  onInteractionModeChange(value: PointQueryInteractionMode): void {
    this.viewer.setInteractionMode(value);
  }

  onScaleToolsEnabledChange(enabled: boolean): void {
    this.scaleTools.setEnabled(enabled);
  }

  toggleScaleLayer(layerId: string): void {
    this.scaleTools.toggleLayerSelection(layerId);
  }
}
