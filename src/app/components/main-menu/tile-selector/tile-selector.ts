import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TileService } from '../../../services/tile.service';
import { TileProvider } from '../../../models';
import { MenuPanelComponent } from '../menu-section.model';

/**
 * Selector de proveedores de tiles (mapas base)
 */
@Component({
  selector: 'app-tile-selector',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './tile-selector.html',
  styleUrl: './tile-selector.scss',
})
export class TileSelectorComponent implements MenuPanelComponent {
  readonly tileService = inject(TileService);

  /**
   * Implementación de MenuPanelComponent
   */
  onPanelOpen(): void {
    // Hook cuando el panel se abre - por ahora no hace nada
  }

  /**
   * Obtiene todos los proveedores disponibles
   */
  get providers(): TileProvider[] {
    return this.tileService.getAvailableProviders();
  }

  /**
   * Verifica si un proveedor está activo
   */
  isActive(providerId: string): boolean {
    return this.tileService.currentProvider().id === providerId;
  }

  /**
   * Selecciona un proveedor
   */
  selectProvider(providerId: string): void {
    this.tileService.setProvider(providerId);
  }

  /**
   * Obtiene el icono según el tipo de mapa
   */
  getProviderIcon(providerId: string): string {
    switch (providerId) {
      case 'argenmap':
        return 'map';
      case 'satellite':
        return 'satellite_alt';
      case 'osm':
        return 'public';
      case 'cartoDB':
      case 'cartoDBDark':
        return 'layers';
      default:
        return 'terrain';
    }
  }
}
