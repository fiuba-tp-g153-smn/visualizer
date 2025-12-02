import { Component, computed, inject, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { LayerService, Layer, LayerGroup } from '../services/layer.service';
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
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerList {
  private layerService = inject(LayerService);

  // Búsqueda
  searchQuery = signal('');

  get layerGroups() {
    return this.layerService.getLayerGroups();
  }

  // Grupos filtrados por búsqueda
  filteredGroups = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const groups = this.layerGroups;

    if (!query) {
      return groups;
    }

    return groups
      .map((group) => {
        // Filtrar capas que coincidan
        const filteredLayers = group.layers.filter(
          (layer) =>
            layer.name.toLowerCase().includes(query) ||
            layer.description?.toLowerCase().includes(query) ||
            layer.sublayers?.some(
              (sub) =>
                sub.name.toLowerCase().includes(query) ||
                sub.description?.toLowerCase().includes(query)
            )
        );

        // Si el nombre del grupo coincide, mostrar todas las capas
        if (group.name.toLowerCase().includes(query)) {
          return { ...group, expanded: true };
        }

        return {
          ...group,
          layers: filteredLayers,
          expanded: filteredLayers.length > 0, // Expandir si hay resultados
        };
      })
      .filter((group) => group.layers.length > 0);
  });

  activeLayersCount = computed(() => this.layerService.getActiveLayersCount());

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  onLayerVisibilityChange(layerId: string): void {
    this.layerService.toggleLayerVisibility(layerId);
  }

  onOpacityChange(layerId: string, opacity: number): void {
    this.layerService.setLayerOpacity(layerId, opacity);
  }

  clearAllLayers(): void {
    this.layerService.clearAllLayers();
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

  // Verifica si la capa tiene sublayers (para no mostrar checkbox en el padre)
  hasSublayers(layer: Layer): boolean {
    return !!layer.sublayers && layer.sublayers.length > 0;
  }
}
