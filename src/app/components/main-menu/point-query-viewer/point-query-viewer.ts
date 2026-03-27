import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PointQueryInteractionMode } from '../../../models';
import { PointQueryViewerService } from '../../../services/layers/point-query-tools.service';
import { MenuPanelComponent } from '../menu-section.model';

@Component({
  selector: 'app-point-query-viewer',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatRadioModule, MatTooltipModule],
  templateUrl: './point-query-viewer.html',
  styleUrl: './point-query-viewer.scss',
})
export class PointQueryViewerComponent implements MenuPanelComponent {
  readonly viewer = inject(PointQueryViewerService);
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
}
