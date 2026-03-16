import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

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
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './point-query-viewer.html',
  styleUrl: './point-query-viewer.scss',
})
export class PointQueryViewerComponent implements MenuPanelComponent {
  readonly viewer = inject(PointQueryViewerService);

  readonly interactionModeOptions: Array<{ value: PointQueryInteractionMode; label: string }> = [
    { value: 'manual', label: 'Manual (click)' },
    { value: 'automatic', label: 'Automático' },
  ];

  onPanelOpen(): void {}

  onPanelClose(): void {}

  onViewerEnabledToggle(event: MatCheckboxChange): void {
    this.viewer.setViewerEnabled(event.checked);
  }

  onInteractionModeChange(event: MatSelectChange): void {
    this.viewer.setInteractionMode(event.value as PointQueryInteractionMode);
  }
}
