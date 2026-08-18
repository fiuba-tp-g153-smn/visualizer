import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { LayersService } from '../../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../../services/layers/layer-control.service';
import { LayerAvailabilityService } from '../../../../../services/layers/layer-availability.service';
import { LayerGroup, LayerSelectionMode, LayerSubgroup } from '../../../../../models';
import { LayerItemComponent, LayerItemMode } from '../layer-item/layer-item';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner';

const MIN_SEARCH_LENGTH = 2;

@Component({
  selector: 'app-available-layers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
    LayerItemComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './available-layers.html',
  styleUrl: './available-layers.scss',
})
export class AvailableLayersComponent {
  readonly LayerItemMode = LayerItemMode;
  readonly LayerSelectionMode = LayerSelectionMode;

  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);
  private readonly availabilityService = inject(LayerAvailabilityService);

  /** Subgroup ids whose availability recheck is currently in flight. */
  private readonly recheckingSubgroups = signal<ReadonlySet<string>>(new Set());

  searchText = signal('');

  hasSearch = computed(() => this.searchText().trim().length >= MIN_SEARCH_LENGTH);

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  filteredGroups = computed(() => {
    const trimmed = this.searchText().trim();
    const search = trimmed.length >= MIN_SEARCH_LENGTH ? this.normalizeText(trimmed) : '';
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

  /** True when every layer in the subgroup has been found to have no data. */
  isSubgroupUnavailable(subgroup: LayerSubgroup): boolean {
    return (
      subgroup.layers.length > 0 &&
      subgroup.layers.every((layer) => this.availabilityService.isUnavailable(layer))
    );
  }

  /** True when every layer across all of the group's subgroups has no data. */
  isGroupUnavailable(group: LayerGroup): boolean {
    return (
      group.subgroups.length > 0 &&
      group.subgroups.every((subgroup) => this.isSubgroupUnavailable(subgroup))
    );
  }

  /** True when at least one product in the subgroup is greyed out. */
  subgroupHasUnavailableLayer(subgroup: LayerSubgroup): boolean {
    return subgroup.layers.some((layer) => this.availabilityService.isUnavailable(layer));
  }

  isSubgroupRechecking(subgroupId: string): boolean {
    return this.recheckingSubgroups().has(subgroupId);
  }

  /**
   * Manually re-check availability for every product in the subgroup, skipping
   * the 60s re-prime wait. `stopPropagation` keeps the click from toggling the
   * expansion panel it lives in.
   */
  async recheckSubgroup(subgroup: LayerSubgroup, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.isSubgroupRechecking(subgroup.id)) return;
    this.recheckingSubgroups.update((ids) => new Set(ids).add(subgroup.id));
    try {
      await this.availabilityService.recheckMany(subgroup.layers);
    } finally {
      this.recheckingSubgroups.update((ids) => {
        const next = new Set(ids);
        next.delete(subgroup.id);
        return next;
      });
    }
  }
}
