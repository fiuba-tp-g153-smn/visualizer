import { Component, inject, signal, computed, Signal } from '@angular/core';
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
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LayerService } from '../../../services/layer.service';
import {
  Layer,
  ActiveLayerGroup,
  ACTIVE_LAYER_GROUP_DEFINITIONS,
  LayerGroup,
  LayerSubgroup,
  ZIndexGroupMetadata,
} from '../../../models';
import { MenuPanelComponent } from '../menu-section.model';
import { LayerItemComponent } from './layer-item/layer-item';

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
    MatInputModule,
    MatFormFieldModule,
    DragDropModule,
    LayerItemComponent,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent {
  readonly layerService = inject(LayerService);

  // Estado de expansión de grupos de capas activas (dinámico desde definiciones)
  private groupExpansionState = new Map<ActiveLayerGroup, ReturnType<typeof signal<boolean>>>(
    Object.values(ACTIVE_LAYER_GROUP_DEFINITIONS).map((def) => [def.id, signal(true)]),
  );

  // Estado local
  searchText = signal('');

  /**
   * Indica si hay búsqueda activa
   */
  hasSearch = computed(() => this.searchText().trim().length > 0);

  /**
   * Indica si hay capas disponibles para mostrar
   */
  hasAvailableLayers = computed(() => {
    return this.layerService.layerGroups().some((group) => {
      return group.subgroups.some((subgroup) => subgroup.layers.length > 0);
    });
  });

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

    // 1. Obtener grupos base
    const baseGroups = this.layerService.layerGroups();

    // 2. Procesar grupos (filtrar vacíos y aplicar búsqueda si existe)
    return baseGroups
      .map((group) => {
        // Si hay búsqueda, filtrar por nombre
        const groupNameMatches = search ? this.normalizeText(group.name).includes(search) : true;

        // Filtrar subgrupos
        const filteredSubgroups = group.subgroups
          .map((subgroup) => {
            const subgroupNameMatches = search
              ? this.normalizeText(subgroup.name).includes(search)
              : true;

            // Filtrar capas del subgrupo
            const layers = subgroup.layers.filter((layer) => {
              if (!search) return true;
              return (
                this.normalizeText(layer.name).includes(search) ||
                subgroupNameMatches ||
                groupNameMatches
              );
            });

            // Retornar subgrupo procesado
            return {
              ...subgroup,
              layers,
              _shouldExpandSubgroup: search
                ? layers.length > 0 && layers.length < subgroup.layers.length
                : false,
            };
          })
          .filter((subgroup) => subgroup.layers.length > 0); // Ocultar subgrupos vacíos

        // Determinar expansión del grupo
        const hasMatchingLayers = filteredSubgroups.some((sg) => sg._shouldExpandSubgroup);
        const hasMatchingSubgroups =
          search && filteredSubgroups.some((sg) => this.normalizeText(sg.name).includes(search));

        return {
          ...group,
          subgroups: filteredSubgroups,
          _shouldExpandGroup: hasMatchingLayers || (hasMatchingSubgroups && !groupNameMatches),
        };
      })
      .filter((group) => group.subgroups.length > 0); // Ocultar grupos vacíos
  });

  /**
   * Implementación de MenuPanelComponent
   */
  onPanelOpen(): void {
    // Hook cuando el panel se abre
  }

  /**
   * Obtiene capas activas organizadas en grupos de z-index con metadata
   * Ordenadas por rango de z-index (mayor primero = OVERLAY antes que BASE)
   */
  activeLayerGroups = computed<ZIndexGroupMetadata[]>(() => {
    return Object.values(ACTIVE_LAYER_GROUP_DEFINITIONS)
      .sort((a, b) => b.zIndexRange.min - a.zIndexRange.min)
      .map((definition) => {
        const layers = this.getLayersForGroup(definition.id);
        const expansionSignal = this.groupExpansionState.get(definition.id)!;

        return {
          id: definition.id,
          name: definition.name,
          subtitle: definition.subtitle,
          description: definition.description,
          icon: definition.icon,
          layers,
          expanded: () => expansionSignal(),
          setExpanded: (value: boolean) => this.setGroupExpanded(definition.id, value),
          onDrop: (event: CdkDragDrop<Layer[]>) => this.handleGroupDrop(event, definition.id),
          clearGroup: (event: Event) => this.handleClearGroup(event, definition.id),
        };
      });
  });

  /**
   * Obtiene todas las capas de un grupo específico
   */
  private getLayersForGroup(groupId: ActiveLayerGroup): Layer[] {
    return this.layerService.getActiveLayersForGroup(groupId);
  }

  /**
   * Establece el estado de expansión de un grupo
   */
  private setGroupExpanded(groupId: ActiveLayerGroup, expanded: boolean): void {
    const signal = this.groupExpansionState.get(groupId);
    if (signal) {
      signal.set(expanded);
    }
  }

  /**
   * Filtra capas visibles (para tab "Activas")
   */
  getActiveLayers(): Layer[] {
    return this.layerService.activeLayers();
  }

  /**
   * Cuenta cuántas capas activas tiene un grupo
   */
  getActiveLayersCountInGroup(group: LayerGroup): number {
    let count = 0;
    for (const subgroup of group.subgroups) {
      for (const layer of subgroup.layers) {
        if (layer.visible) count++;
      }
    }
    return count;
  }

  /**
   * Cuenta cuántas capas activas tiene un subgrupo
   */
  getActiveLayersCountInSubgroup(subgroup: LayerSubgroup): number {
    return subgroup.layers.filter((layer) => layer.visible).length;
  }

  /**
   * Maneja el drop de capas dentro de un grupo (drag & drop)
   */
  private handleGroupDrop(event: CdkDragDrop<Layer[]>, groupId: ActiveLayerGroup): void {
    const groupLayers = this.getLayersForGroup(groupId);
    const layers = [...groupLayers];
    moveItemInArray(layers, event.previousIndex, event.currentIndex);

    // Actualizar el orden de los zIndex solo dentro del grupo
    const orderedIds = layers.map((layer) => layer.id);
    this.layerService.setLayerOrder(orderedIds);
  }

  /**
   * Desactiva todas las capas de un grupo
   */
  private handleClearGroup(event: Event, groupId: ActiveLayerGroup): void {
    event.stopPropagation(); // Evitar que se colapse/expanda el panel
    const groupLayers = this.getLayersForGroup(groupId);
    groupLayers.forEach((layer) => {
      this.layerService.deactivateLayer(layer.id);
    });
  }
}
