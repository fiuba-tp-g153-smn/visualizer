import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseMapService } from '../../../services/base-maps/base-map.service';
import { BaseMap } from '../../../models';
import { MenuPanelComponent } from '../menu-section.model';

/**
 * Base Map Selector Component
 *
 * Provides a UI for selecting the background map style.
 * Displays previews of available base maps and allows users to switch between them.
 * The selected base map is persisted across sessions.
 */
@Component({
  selector: 'app-base-map-selector',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './base-map-selector.html',
  styleUrl: './base-map-selector.scss',
})
export class BaseMapSelectorComponent implements MenuPanelComponent {
  readonly baseMapService = inject(BaseMapService);

  /**
   * MenuPanelComponent lifecycle hook
   * Called when the panel is opened
   */
  onPanelOpen(): void {
    // Hook for future initialization if needed
  }

  /**
   * Get all available base maps
   */
  get baseMaps(): BaseMap[] {
    return this.baseMapService.getAvailableBaseMaps();
  }

  /**
   * Check if a base map is currently active
   */
  isActive(baseMapId: string): boolean {
    return this.baseMapService.currentBaseMap().id === baseMapId;
  }

  /**
   * Select a base map
   */
  selectBaseMap(baseMapId: string): void {
    this.baseMapService.setBaseMap(baseMapId);
  }

  /**
   * Get the preview URL for a base map
   * Replaces template variables with actual preview coordinates
   */
  getPreviewUrl(baseMap: BaseMap): string {
    return baseMap.url
      .replace('{s}', 'a')
      .replace('{z}', String(baseMap.previewZ || 0))
      .replace('{x}', String(baseMap.previewX || 0))
      .replace('{y}', String(baseMap.previewY || 0))
      .replace('{-y}', String(baseMap.previewY || 0))
      .replace('{r}', '');
  }
}
