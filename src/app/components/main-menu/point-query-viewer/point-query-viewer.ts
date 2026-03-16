import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';

import { PointValuePanelComponent } from '../../point-value-panel/point-value-panel';
import { PointQueryViewerService } from '../../../services/layers/point-query-viewer.service';
import { MenuPanelComponent } from '../menu-section.model';

@Component({
  selector: 'app-point-query-viewer',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, PointValuePanelComponent],
  templateUrl: './point-query-viewer.html',
  styleUrl: './point-query-viewer.scss',
})
export class PointQueryViewerComponent implements MenuPanelComponent, OnInit, OnDestroy {
  readonly viewer = inject(PointQueryViewerService);

  onPanelOpen(): void {}

  onPanelClose(): void {}

  ngOnInit(): void {
    this.viewer.setMenuSectionOpen(true);
  }

  ngOnDestroy(): void {
    this.viewer.setMenuSectionOpen(false);
  }

  onFloatingToggle(event: MatCheckboxChange): void {
    this.viewer.setFloatingViewerEnabled(event.checked);
  }
}
