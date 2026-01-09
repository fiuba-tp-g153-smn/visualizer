import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
  ],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.scss',
})
export class LayerListComponent implements MenuPanelComponent {
  readonly layerService = inject(LayerService);

  // Estado local
  searchText = signal('');
  expandedGroups = signal<Set<string>>(new Set(['satellite'])); // Satélite expandido por defecto

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
   * Filtra capas visibles (para tab "Activas")
   */
  getActiveLayers(): Layer[] {
    return this.layerService.activeLayers();
  }
}
