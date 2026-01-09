import { Component, signal } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LayerListComponent } from './layer-list/layer-list';
import { TileSelectorComponent } from './tile-selector/tile-selector';
import { MenuSection } from './menu-section.model';

/**
 * Configuración de secciones del menú
 */
const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'layers',
    title: 'Capas del Mapa',
    icon: 'layers',
    tooltip: 'Capas del mapa',
    component: LayerListComponent,
  },
  {
    id: 'tiles',
    title: 'Mapa Base',
    icon: 'map',
    tooltip: 'Configurar mapa base',
    component: TileSelectorComponent,
  },
];

/**
 * Menú principal con controles del mapa
 * Barra de botones flotante + panel lateral excluyente
 */
@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, MatIconModule, MatButtonModule, MatCardModule],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenuComponent {
  // Secciones disponibles del menú
  readonly sections = MENU_SECTIONS;

  // Panel activo (ID de la sección o null)
  readonly activePanel = signal<string | null>(null);

  /**
   * Obtiene la sección activa
   */
  getActiveSection(): MenuSection | undefined {
    const activePanelId = this.activePanel();
    return this.sections.find((s) => s.id === activePanelId);
  }

  /**
   * Toggle del panel: abre si está cerrado, cierra si está abierto
   */
  togglePanel(panelId: string): void {
    if (this.activePanel() === panelId) {
      this.closePanel();
    } else {
      this.activePanel.set(panelId);
    }
  }

  /**
   * Cierra el panel actual
   */
  closePanel(): void {
    this.activePanel.set(null);
  }
}
