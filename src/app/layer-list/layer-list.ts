import { Component, computed, inject } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { LayerService, Layer } from '../services/layer.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layer-list',
  imports: [
    MatExpansionModule,
    MatCheckboxModule,
    MatSliderModule,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
    MatTabsModule,
    FormsModule,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerList {
  private layerService = inject(LayerService);

  get layerGroups() {
    return this.layerService.getLayerGroups();
  }

  activeLayersCount = computed(() => this.layerService.getActiveLayersCount());

  onLayerVisibilityChange(layerId: string): void {
    this.layerService.toggleLayerVisibility(layerId);
  }

  onOpacityChange(layerId: string, opacity: number): void {
    this.layerService.setLayerOpacity(layerId, opacity);
  }

  formatOpacity(value: number): string {
    return `${value}%`;
  }

  getLayerIcon(layer: Layer): string {
    switch (layer.type) {
      case 'point':
        return 'place';
      case 'raster':
        return 'image';
      case 'vector':
        return 'call_made';
      default:
        return 'layers';
    }
  }
}
