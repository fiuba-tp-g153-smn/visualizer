import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LayersService } from '../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../services/layers/layer-control.service';
import { ActiveLayerGroupId, Layer } from '../../../../models';
import { ACTIVE_LAYER_GROUP_DEFINITIONS } from '../../../../config/layers';
import { LayerItemComponent } from '../layer-item/layer-item';

/**
 * Componente de capas activas
 * Muestra las capas activadas organizadas por grupos de z-index
 * con controles de orden y opacidad
 */
@Component({
  selector: 'app-active-layers',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
    DragDropModule,
    LayerItemComponent,
  ],
  templateUrl: './active-layers.html',
  styleUrl: './active-layers.scss',
})
export class ActiveLayersComponent {
  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);

  private groupExpansionState = new Map<ActiveLayerGroupId, ReturnType<typeof signal<boolean>>>(
    Object.values(ACTIVE_LAYER_GROUP_DEFINITIONS).map((def) => [def.id, signal(true)]),
  );

  /**
   * Obtiene capas activas organizadas en grupos de z-index con metadata
   */
  activeLayerGroups = computed(() => {
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

  private getLayersForGroup(groupId: ActiveLayerGroupId): Layer[] {
    return this.controlService.getActiveLayersForGroup(groupId).map((item) => item.layer);
  }

  private setGroupExpanded(groupId: ActiveLayerGroupId, expanded: boolean): void {
    const signal = this.groupExpansionState.get(groupId);
    if (signal) {
      signal.set(expanded);
    }
  }

  getActiveLayers(): Layer[] {
    return this.controlService.activeLayers().map((item) => item.layer);
  }

  private handleGroupDrop(event: CdkDragDrop<Layer[]>, groupId: ActiveLayerGroupId): void {
    const groupLayers = this.getLayersForGroup(groupId);
    const layers = [...groupLayers];
    moveItemInArray(layers, event.previousIndex, event.currentIndex);

    const orderedIds = layers.map((layer) => layer.id);
    this.controlService.setActiveGroupLayersOrder(orderedIds);
  }

  private handleClearGroup(event: Event, groupId: ActiveLayerGroupId): void {
    event.stopPropagation();
    const groupLayers = this.getLayersForGroup(groupId);
    groupLayers.forEach((layer) => {
      this.controlService.deactivateLayer(layer.id);
    });
  }
}
