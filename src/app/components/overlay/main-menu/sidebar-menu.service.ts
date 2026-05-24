import { Injectable, signal } from '@angular/core';
import { LayerListComponent } from './layer-list/layer-list';
import { BaseMapSelectorComponent } from './base-map-selector/base-map-selector';
import { PolygonManagerComponent } from './polygon-manager/polygon-manager';
import { MapToolsComponent } from './map-tools/tools';
import { GeneralSettingsComponent } from './general-settings/general-settings';
import { MenuSection } from './menu-section.model';

const MENU_SECTIONS: ReadonlyArray<MenuSection> = [
  {
    id: 'layers',
    title: 'Capas del Mapa',
    icon: 'layers',
    tooltip: 'Capas del mapa',
    component: LayerListComponent,
  },
  {
    id: 'polygons',
    title: 'Polígonos',
    icon: 'polyline',
    tooltip: 'Graficar polígono',
    component: PolygonManagerComponent,
  },
  {
    id: 'map-tools',
    title: 'Herramientas del mapa',
    icon: 'handyman',
    tooltip: 'Herramientas del mapa',
    component: MapToolsComponent,
  },
  {
    id: 'basemaps',
    title: 'Mapa Base',
    icon: 'map',
    tooltip: 'Seleccionar mapa base',
    component: BaseMapSelectorComponent,
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

  togglePanel(panelId: string): void {
    if (this.activePanel() === panelId) {
      this.closePanel();
    } else {
      this.activePanel.set(panelId);
    }
  }

  closePanel(): void {
    this.activePanel.set(null);
  }
}
