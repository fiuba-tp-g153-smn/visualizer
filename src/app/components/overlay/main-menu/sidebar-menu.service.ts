import { Injectable, signal } from '@angular/core';
import { MenuSection } from './menu-section.model';
import { LayerListComponent } from './layer-list/layer-list';
import { AlertsPanelComponent } from './alerts-panel/alerts-panel';
import { MapToolsComponent } from './map-tools/tools';
import { MapExplorerComponent } from './map-explorer/map-explorer';
import { GeneralSettingsComponent } from './general-settings/general-settings';

/**
 * Configuración de secciones del menú.
 */
const MENU_SECTIONS: ReadonlyArray<MenuSection> = [
  {
    id: 'layers',
    title: 'Capas del Mapa',
    icon: 'layers',
    tooltip: 'Capas del mapa',
    component: LayerListComponent,
  },
  {
    id: 'alerts',
    title: 'Avisos a corto plazo',
    icon: 'warning',
    tooltip: 'Avisos a corto plazo',
    component: AlertsPanelComponent,
  },
  {
    id: 'map-tools',
    title: 'Herramientas del mapa',
    icon: 'handyman',
    tooltip: 'Herramientas del mapa',
    component: MapToolsComponent,
  },
  {
    id: 'explore',
    title: 'Explorar mapa',
    icon: 'map',
    tooltip: 'Buscar lugares y elegir mapa base',
    component: MapExplorerComponent,
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: 'tune',
    tooltip: 'Configuración general',
    component: GeneralSettingsComponent,
  },
];

@Injectable({ providedIn: 'root' })
export class SidebarMenuService {
  readonly sections: ReadonlyArray<MenuSection> = MENU_SECTIONS;
  readonly activePanel = signal<string | null>(null);

  getActiveSection(): MenuSection | undefined {
    return this.sections.find((s) => s.id === this.activePanel());
  }

  /**
   * Toggle del panel: abre si está cerrado, cierra si está abierto.
   */
  togglePanel(panelId: string): void {
    if (this.activePanel() === panelId) {
      this.closePanel();
      return;
    }

    this.activePanel.set(panelId);
  }

  closePanel(): void {
    this.activePanel.set(null);
  }
}
