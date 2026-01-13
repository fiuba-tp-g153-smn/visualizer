import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
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
    MatTooltipModule,
    MatExpansionModule,
    MatSliderModule,
    MatListModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    DragDropModule,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent {
  readonly layerService = inject(LayerService);

  // Estado local
  searchText = signal('');

  /**
   * Indica si hay búsqueda activa
   */
  hasSearch = computed(() => this.searchText().trim().length > 0);

  /**
   * Normaliza texto removiendo tildes y convirtiendo a minúsculas
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Grupos filtrados según el texto de búsqueda
   */
  filteredGroups = computed(() => {
    const search = this.normalizeText(this.searchText().trim());
    if (!search) {
      return this.layerService.layerGroups().map((group) => ({
        ...group,
        _shouldExpandGroup: false,
        subgroups: group.subgroups.map((sg) => ({ ...sg, _shouldExpandSubgroup: false })),
      }));
    }

    return this.layerService
      .layerGroups()
      .map((group) => {
        const groupNameMatches = this.normalizeText(group.name).includes(search);

        // Filtrar subgrupos y capas
        const filteredSubgroups = group.subgroups
          .map((subgroup) => {
            const subgroupNameMatches = this.normalizeText(subgroup.name).includes(search);
            const matchingLayers = subgroup.layers.filter((layer) =>
              this.normalizeText(layer.name).includes(search)
            );

            // Incluir todas las capas si coincide el grupo o subgrupo
            const layers =
              matchingLayers.length > 0 || subgroupNameMatches || groupNameMatches
                ? subgroup.layers.filter(
                    (layer) =>
                      this.normalizeText(layer.name).includes(search) ||
                      subgroupNameMatches ||
                      groupNameMatches
                  )
                : [];

            return {
              ...subgroup,
              layers,
              // Expandir subgrupo solo si hay capas específicas que coinciden
              _shouldExpandSubgroup: matchingLayers.length > 0,
            };
          })
          .filter((subgroup) => subgroup.layers.length > 0);

        // Expandir grupo si:
        // - Alguna capa específica coincide (hay subgrupos que deben expandirse)
        // - O si el nombre del subgrupo coincide (pero no el grupo en sí)
        const hasMatchingLayers = filteredSubgroups.some((sg) => sg._shouldExpandSubgroup);
        const hasMatchingSubgroups = filteredSubgroups.some((sg) =>
          this.normalizeText(sg.name).includes(search)
        );

        return {
          ...group,
          subgroups: filteredSubgroups,
          _shouldExpandGroup: hasMatchingLayers || (hasMatchingSubgroups && !groupNameMatches),
        };
      })
      .filter((group) => group.subgroups.length > 0);
  });

  /**
   * Implementación de MenuPanelComponent
   */
  onPanelOpen(): void {
    // Hook cuando el panel se abre
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

  /**
   * Formatea el valor de opacidad para el slider
   */
  formatOpacity(value: number): string {
    return `${value}%`;
  }
}
