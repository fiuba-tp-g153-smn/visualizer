import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { LayersService } from '../../../../services/layers/layers.service';
import { LayerControlService } from '../../../../services/layers/layer-control.service';
import { SyncPlaybackService } from '../../../../services/layers/sync-playback.service';
import { MenuPanelComponent } from '../menu-section.model';
import { AvailableLayersComponent } from './available-layers/available-layers';
import { ActiveLayersComponent } from './active-layers/active-layers';
import { SyncPlaybackComponent } from './sync-playback/sync-playback';

/**
 * Contenedor de listas de capas con pestañas
 * Componente inteligente que coordina las capas disponibles y activas
 */
@Component({
  selector: 'app-layer-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    AvailableLayersComponent,
    ActiveLayersComponent,
    SyncPlaybackComponent,
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent {
  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);
  private readonly syncService = inject(SyncPlaybackService);

  hasAvailableLayers = computed(() => {
    return this.layersService.getLayerGroups().some((group) => {
      return group.subgroups.some((subgroup) => subgroup.layers.length > 0);
    });
  });

  readonly syncIsPlaying = computed(() => this.syncService.syncState().isPlaying);

  getActiveLayersCount(): number {
    return this.controlService.activeLayers().length;
  }

  onPanelOpen(): void {
    // Hook cuando el panel se abre
  }
}
