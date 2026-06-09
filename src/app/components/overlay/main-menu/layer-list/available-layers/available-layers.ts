import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { LayersService } from '../../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../../services/layers/layer-control.service';
import { LayerGroup, LayerSelectionMode, LayerSubgroup } from '../../../../../models';
import { LayerItemComponent, LayerItemMode } from '../layer-item/layer-item';

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
  readonly LayerItemMode = LayerItemMode;
  readonly LayerSelectionMode = LayerSelectionMode;

  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);

  searchText = signal('');

  hasSearch = computed(() => this.searchText().trim().length > 0);

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  filteredGroups = computed(() => {
    const search = this.normalizeText(this.searchText().trim());
    const baseGroups = this.layersService.getLayerGroups();

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

  getActiveLayersCountInGroup(group: LayerGroup): number {
    let count = 0;
    for (const subgroup of group.subgroups) {
      for (const layer of subgroup.layers) {
        const controls = this.controlService.getControls(layer.id);
        if (controls?.visible) count++;
      }
    }
    return count;
  }

  getActiveLayersCountInSubgroup(subgroup: LayerSubgroup): number {
    return subgroup.layers.filter((layer) => {
      const controls = this.controlService.getControls(layer.id);
      return controls?.visible;
    }).length;
  }
}
