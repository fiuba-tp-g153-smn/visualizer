import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TileService } from '../../../services/tiles/tile.service';
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
   * Obtiene la URL de preview del proveedor reemplazando las coordenadas
   */
  getPreviewUrl(provider: TileProvider): string {
    return provider.url
      .replace('{s}', 'a')
      .replace('{z}', String(provider.previewZ || 0))
      .replace('{x}', String(provider.previewX || 0))
      .replace('{y}', String(provider.previewY || 0))
      .replace('{-y}', String(provider.previewY || 0))
      .replace('{r}', '');
  }
}
