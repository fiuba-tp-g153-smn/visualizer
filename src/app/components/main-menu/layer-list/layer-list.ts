import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { LayersService } from '../../../services/layers/layers.service';
import { LayerControlService } from '../../../services/layers/layer-control.service';
import { MenuPanelComponent } from '../menu-section.model';
import { AvailableLayersComponent } from './available-layers/available-layers';
import { ActiveLayersComponent } from './active-layers/active-layers';

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
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent {
  private readonly layersService = inject(LayersService);
  private readonly controlService = inject(LayerControlService);

  hasAvailableLayers = computed(() => {
    return this.layersService.getLayerGroups().some((group) => {
      return group.subgroups.some((subgroup) => subgroup.layers.length > 0);
    });
  });

  getActiveLayersCount(): number {
    return this.controlService.activeLayers().length;
  }

  onPanelOpen(): void {
    // Hook cuando el panel se abre
  }
}
