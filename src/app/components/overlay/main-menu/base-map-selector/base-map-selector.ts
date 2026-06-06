import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseMapService } from '../../../../services/base-maps/base-map.service';
import { BaseMap } from '../../../../models';
import { MenuPanelComponent } from '../menu-section.model';

@Component({
  selector: 'app-base-map-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './base-map-selector.html',
  styleUrl: './base-map-selector.scss',
})
export class BaseMapSelectorComponent implements MenuPanelComponent {
  readonly baseMapService = inject(BaseMapService);

  readonly baseMaps = this.baseMapService.providers;
  readonly loadState = this.baseMapService.loadState;
  readonly currentBaseMapId = computed(() => this.baseMapService.currentBaseMap()?.id ?? null);

  onPanelOpen(): void {}

  isActive(baseMapId: string): boolean {
    return this.currentBaseMapId() === baseMapId;
  }

  selectBaseMap(baseMapId: string): void {
    this.baseMapService.setBaseMap(baseMapId);
  }

  getPreviewUrl(baseMap: BaseMap): string {
    return baseMap.url
      .replace('{s}', 'a')
      .replace('{z}', String(baseMap.previewZ))
      .replace('{x}', String(baseMap.previewX))
      .replace('{y}', String(baseMap.previewY))
      .replace('{-y}', String(baseMap.previewY))
      .replace('{r}', '');
  }
}
