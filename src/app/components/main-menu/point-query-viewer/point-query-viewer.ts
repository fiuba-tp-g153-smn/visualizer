import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  PointQueryInteractionMode,
  PointQueryViewerService,
} from '../../../services/layers/point-query-tools.service';
import { MenuPanelComponent } from '../menu-section.model';

@Component({
  selector: 'app-point-query-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatRadioModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
  ],
  templateUrl: './point-query-viewer.html',
  styleUrl: './point-query-viewer.scss',
})
export class PointQueryViewerComponent implements MenuPanelComponent {
  readonly viewer = inject(PointQueryViewerService);

  readonly interactionModeOptions: Array<{
    value: PointQueryInteractionMode;
    label: string;
    tooltip: string;
  }> = [
    { value: 'off', label: 'Desactivado', tooltip: 'No mostrar visores de datos puntuales' },
    {
      value: 'manual',
      label: 'Manual',
      tooltip: 'Mostrar datos al hacer clic en el mapa',
    },
    {
      value: 'automatic',
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
