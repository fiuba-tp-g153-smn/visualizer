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
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import {
  LayerService,
  Layer,
  LayerGroup,
  LayerSubgroup,
  ActiveLayer,
} from '../services/layer.service';
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
    MatSelectModule,
    MatTabsModule,
    FormsModule,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerList {
  private layerService = inject(LayerService);

  // Búsqueda
  searchQuery = signal('');

  // Tab activa
  selectedTabIndex = signal(0);

  get layerGroups() {
    return this.layerService.getLayerGroups();
  }

  // Capas activas
  get activeLayers() {
    return this.layerService.activeLayers;
  }

  // Control de tiempo
  get isPlaying() {
    return this.layerService.isPlaying;
  }

  get globalTimeIndex() {
    return this.layerService.globalTimeIndex;
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
        // Filtrar subgrupos y sus capas
        const filteredSubgroups = group.subgroups
          .map((subgroup) => {
            const filteredLayers = subgroup.layers.filter(
              (layer) =>
                layer.name.toLowerCase().includes(query) ||
                layer.description?.toLowerCase().includes(query)
            );

            // Si el nombre del subgrupo coincide, mostrar todas las capas
            if (subgroup.name.toLowerCase().includes(query)) {
              return { ...subgroup, expanded: true };
            }

            return {
              ...subgroup,
              layers: filteredLayers,
              expanded: filteredLayers.length > 0,
            };
          })
          .filter((subgroup) => subgroup.layers.length > 0);

        // Si el nombre del grupo coincide, mostrar todos los subgrupos
        if (group.name.toLowerCase().includes(query)) {
          return { ...group, expanded: true };
        }

        return {
          ...group,
          subgroups: filteredSubgroups,
          expanded: filteredSubgroups.length > 0,
        };
      })
      .filter((group) => group.subgroups.length > 0);
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

  // Verifica si la capa tiene plazos de pronóstico
  hasForecastHours(layer: Layer): boolean {
    return !!layer.metadata?.forecastHours && layer.metadata.forecastHours.length > 0;
  }

  // Maneja el cambio de plazo de pronóstico
  onForecastHourChange(layerId: string, hour: number): void {
    this.layerService.setForecastHour(layerId, hour);
  }

  // Cuenta capas activas en un subgrupo
  getActiveLayersInSubgroup(subgroup: LayerSubgroup): number {
    return subgroup.layers.filter((layer) => layer.visible).length;
  }

  // Cuenta capas activas en un grupo
  getActiveLayersInGroup(group: LayerGroup): number {
    return group.subgroups.reduce(
      (count, subgroup) => count + this.getActiveLayersInSubgroup(subgroup),
      0
    );
  }

  // ==================== CAPAS ACTIVAS ====================

  moveLayerUp(layerId: string): void {
    this.layerService.moveLayerUp(layerId);
  }

  moveLayerDown(layerId: string): void {
    this.layerService.moveLayerDown(layerId);
  }

  deactivateLayer(layerId: string): void {
    this.layerService.deactivateLayer(layerId);
  }

  isFirstLayer(layer: ActiveLayer): boolean {
    const layers = this.activeLayers();
    return layers.length > 0 && layers[0].id === layer.id;
  }

  isLastLayer(layer: ActiveLayer): boolean {
    const layers = this.activeLayers();
    return layers.length > 0 && layers[layers.length - 1].id === layer.id;
  }

  // ==================== CONTROL DE TIEMPO ====================

  getAvailableForecastHours(): number[] {
    return this.layerService.getAvailableForecastHours();
  }

  getCurrentGlobalHour(): number | null {
    return this.layerService.getCurrentGlobalHour();
  }

  togglePlay(): void {
    this.layerService.togglePlay(2000);
  }

  advanceTime(): void {
    this.layerService.advanceGlobalTime();
  }

  rewindTime(): void {
    this.layerService.rewindGlobalTime();
  }

  hasTemporalLayers(): boolean {
    return this.activeLayers().some((l) => l.metadata?.forecastHours?.length);
  }
}
