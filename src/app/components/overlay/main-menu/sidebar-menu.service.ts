import { Injectable, signal, Type } from '@angular/core';
import { MenuPanelComponent, MenuSection } from './menu-section.model';

/**
 * Configuración de secciones del menú.
 *
 * Cada panel se carga perezosamente (`loadComponent`) — su código vive en un
 * chunk aparte y se descarga la primera vez que se abre la sección, en lugar de
 * viajar en el bundle inicial.
 */
const MENU_SECTIONS: ReadonlyArray<MenuSection> = [
  {
    id: 'layers',
    title: 'Capas del Mapa',
    icon: 'layers',
    tooltip: 'Capas del mapa',
    loadComponent: () => import('./layer-list/layer-list').then((m) => m.LayerListComponent),
  },
  {
    id: 'polygons',
    title: 'Avisos a Corto Plazo',
    icon: 'polyline',
    tooltip: 'Avisos a Corto Plazo',
    loadComponent: () =>
      import('./polygon-manager/polygon-manager').then((m) => m.PolygonManagerComponent),
  },
  {
    id: 'map-tools',
    title: 'Herramientas del mapa',
    icon: 'handyman',
    tooltip: 'Herramientas del mapa',
    loadComponent: () => import('./map-tools/tools').then((m) => m.MapToolsComponent),
  },
  {
    id: 'basemaps',
    title: 'Mapa Base',
    icon: 'map',
    tooltip: 'Seleccionar mapa base',
    loadComponent: () =>
      import('./base-map-selector/base-map-selector').then((m) => m.BaseMapSelectorComponent),
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: 'tune',
    tooltip: 'Configuración general',
    loadComponent: () =>
      import('./general-settings/general-settings').then((m) => m.GeneralSettingsComponent),
  },
];

@Injectable({ providedIn: 'root' })
export class SidebarMenuService {
  readonly sections: ReadonlyArray<MenuSection> = MENU_SECTIONS;
  readonly activePanel = signal<string | null>(null);

  // Componente del panel activo, resuelto perezosamente al abrir la sección.
  // Es null mientras el chunk se descarga (o cuando no hay panel abierto).
  readonly activeComponent = signal<Type<MenuPanelComponent> | null>(null);

  constructor() {
    // Eagerly prefetch every panel chunk on startup (this root service is
    // constructed when the always-present sidebar buttons load), so the first
    // open is always instant — no empty-panel flash. Chunks stay separate, so
    // the initial bundle (and TBT) is unaffected; they just download up front.
    for (const section of this.sections) {
      section.loadComponent().catch(() => {
        /* a failed prefetch is harmless — togglePanel will retry on open */
      });
    }
  }

  getActiveSection(): MenuSection | undefined {
    return this.sections.find((s) => s.id === this.activePanel());
  }

  /**
   * Toggle del panel: abre si está cerrado, cierra si está abierto.
   * Al abrir, dispara la carga perezosa del componente del panel.
   */
  togglePanel(panelId: string): void {
    if (this.activePanel() === panelId) {
      this.closePanel();
      return;
    }

    this.activePanel.set(panelId);
    this.activeComponent.set(null);

    const section = this.sections.find((s) => s.id === panelId);
    if (!section) return;

    void section.loadComponent().then((component) => {
      // Evita una condición de carrera: solo monta si el panel sigue activo
      // (el usuario podría haber cambiado de sección mientras cargaba).
      if (this.activePanel() === panelId) {
        this.activeComponent.set(component);
      }
    });
  }

  closePanel(): void {
    this.activePanel.set(null);
    this.activeComponent.set(null);
  }
}
