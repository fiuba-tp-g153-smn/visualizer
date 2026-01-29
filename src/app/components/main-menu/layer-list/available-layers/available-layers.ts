import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { LayerService } from '../../../../services/layers/layer.service';
import { LayerGroup, LayerSubgroup } from '../../../../models';
import { LayerItemComponent } from '../layer-item/layer-item';

/**
 * Componente de capas disponibles para activar
 * Muestra la lista de capas organizadas por grupos y subgrupos con búsqueda
 */
@Component({
  selector: 'app-available-layers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatExpansionModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    LayerItemComponent,
  ],
  templateUrl: './available-layers.html',
  styleUrl: './available-layers.scss',
})
export class AvailableLayersComponent {
  private readonly layerService = inject(LayerService);

  searchText = signal('');

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
    const baseGroups = this.layerService.layerGroups();

    return baseGroups
      .map((group) => {
        const groupNameMatches = search ? this.normalizeText(group.name).includes(search) : true;

        const filteredSubgroups = group.subgroups
          .map((subgroup) => {
            const subgroupNameMatches = search
              ? this.normalizeText(subgroup.name).includes(search)
              : true;

            const layers = subgroup.layers.filter((layer) => {
              if (!search) return true;
              const layerNameMatches = this.normalizeText(layer.name).includes(search);
              const layerDescMatches = layer.description
                ? this.normalizeText(layer.description).includes(search)
                : false;
              return (
                layerNameMatches || layerDescMatches || groupNameMatches || subgroupNameMatches
              );
            });

            return {
              ...subgroup,
              layers,
              _shouldExpandSubgroup: search ? layers.length > 0 : false,
            };
          })
          .filter((subgroup) => subgroup.layers.length > 0);

        const hasMatchingLayers = filteredSubgroups.some((sg) => sg._shouldExpandSubgroup);
        const hasMatchingSubgroups =
          search && filteredSubgroups.some((sg) => this.normalizeText(sg.name).includes(search));

        return {
          ...group,
          subgroups: filteredSubgroups,
          _shouldExpandGroup: search ? filteredSubgroups.length > 0 : false,
        };
      })
      .filter((group) => group.subgroups.length > 0);
  });

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
}
