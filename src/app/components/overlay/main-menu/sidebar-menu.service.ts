import { Injectable, signal } from '@angular/core';
import { MenuSection } from './menu-section.model';
import { LayerListComponent } from './layer-list/layer-list';
import { AlertsPanelComponent } from './alerts-panel/alerts-panel';
import { MapToolsComponent } from './map-tools/tools';
import { MapExplorerComponent } from './map-explorer/map-explorer';
import { GeneralSettingsComponent } from './general-settings/general-settings';
import { MAP_TEXTS } from '../../../texts';

/**
 * Configuración de secciones del menú.
 */
const SECTIONS = MAP_TEXTS.menu.sections;

const MENU_SECTIONS: ReadonlyArray<MenuSection> = [
  {
    id: 'layers',
    title: SECTIONS.layers.title,
    icon: 'layers',
    tooltip: SECTIONS.layers.tooltip,
    component: LayerListComponent,
  },
  {
    id: 'alerts',
    title: SECTIONS.alerts.title,
    icon: 'warning',
    tooltip: SECTIONS.alerts.tooltip,
    component: AlertsPanelComponent,
  },
  {
    id: 'map-tools',
    title: SECTIONS.mapTools.title,
    icon: 'handyman',
    tooltip: SECTIONS.mapTools.tooltip,
    component: MapToolsComponent,
  },
  {
    id: 'explore',
    title: SECTIONS.explore.title,
    icon: 'map',
    tooltip: SECTIONS.explore.tooltip,
    component: MapExplorerComponent,
  },
  {
    id: 'settings',
    title: SECTIONS.settings.title,
    icon: 'tune',
    tooltip: SECTIONS.settings.tooltip,
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
