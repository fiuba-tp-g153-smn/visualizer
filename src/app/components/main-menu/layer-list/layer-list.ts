import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LayerService } from '../../../services/layer.service';
import { Layer } from '../../../models';
import { MenuPanelComponent } from '../menu-section.model';

/**
 * Lista de capas con controles de visibilidad, opacidad y orden
 */
@Component({
  selector: 'app-layer-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatTooltipModule,
    DragDropModule,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent {
  readonly layerService = inject(LayerService);

  // Estado local
  searchText = signal('');
  expandedGroups = signal<Set<string>>(new Set(['satellite'])); // Satélite expandido por defecto
  expandedSubgroups = signal<Set<string>>(new Set(['satellite-visible', 'satellite-infrared'])); // Algunos subgrupos expandidos por defecto

  /**
   * Grupos filtrados según el texto de búsqueda
   */
  filteredGroups = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    if (!search) {
      return this.layerService.layerGroups();
    }

    return this.layerService
      .layerGroups()
      .map((group) => {
        // Filtrar subgrupos y capas
        const filteredSubgroups = group.subgroups
          .map((subgroup) => ({
            ...subgroup,
            layers: subgroup.layers.filter(
              (layer) =>
                layer.name.toLowerCase().includes(search) ||
                subgroup.name.toLowerCase().includes(search) ||
                group.name.toLowerCase().includes(search)
            ),
          }))
          .filter((subgroup) => subgroup.layers.length > 0);

        return {
          ...group,
          subgroups: filteredSubgroups,
        };
      })
      .filter((group) => group.subgroups.length > 0);
  });

  /**
   * Implementación de MenuPanelComponent
   */
  onPanelOpen(): void {
    // Hook cuando el panel se abre - por ahora no hace nada
  }

  /**
   * Toggle expansión de grupo
   */
  toggleGroup(groupId: string): void {
    const expanded = new Set(this.expandedGroups());
    if (expanded.has(groupId)) {
      expanded.delete(groupId);
    } else {
      expanded.add(groupId);
    }
    this.expandedGroups.set(expanded);
  }

  /**
   * Verifica si un grupo está expandido
   */
  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroups().has(groupId);
  }

  /**
   * Toggle expansión de subgrupo
   */
  toggleSubgroup(subgroupId: string): void {
    const expanded = new Set(this.expandedSubgroups());
    if (expanded.has(subgroupId)) {
      expanded.delete(subgroupId);
    } else {
      expanded.add(subgroupId);
    }
    this.expandedSubgroups.set(expanded);
  }

  /**
   * Verifica si un subgrupo está expandido
   */
  isSubgroupExpanded(subgroupId: string): boolean {
    return this.expandedSubgroups().has(subgroupId);
  }

  /**
   * Filtra capas visibles (para tab "Activas")
   */
  getActiveLayers(): Layer[] {
    return this.layerService.activeLayers();
  }

  /**
   * Maneja el drop en la lista de capas activas (drag & drop)
   */
  onLayerDrop(event: CdkDragDrop<Layer[]>): void {
    const activeLayers = [...this.getActiveLayers()];
    moveItemInArray(activeLayers, event.previousIndex, event.currentIndex);

    // Actualizar el orden de los zIndex
    const orderedIds = activeLayers.map((layer) => layer.id);
    this.layerService.setLayerOrder(orderedIds);
  }

  /**
   * Verifica si una capa está activa
   */
  isLayerActive(layerId: string): boolean {
    return this.getActiveLayers().some((layer) => layer.id === layerId);
  }

  /**
   * Activa una capa (agregar a las activas)
   */
  addLayer(layerId: string): void {
    this.layerService.activateLayer(layerId);
  }

  /**
   * Reemplaza todas las capas con una nueva
   */
  replaceAllLayers(layerId: string): void {
    this.layerService.replaceAllWithLayer(layerId);
  }

  /**
   * Remueve una capa activa
   */
  removeLayer(layerId: string): void {
    this.layerService.deactivateLayer(layerId);
  }
}
