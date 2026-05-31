import { Component, signal, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MenuPanelComponent, MenuSection } from './menu-section.model';

/**
 * Configuración de secciones del menú.
 *
 * Cada panel se carga perezosamente (`loadComponent`) — su código vive en un
 * chunk aparte y se descarga la primera vez que se abre la sección, en lugar de
 * viajar en el bundle inicial.
 */
const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'layers',
    title: 'Capas del Mapa',
    icon: 'layers',
    tooltip: 'Capas del mapa',
    loadComponent: () => import('./layer-list/layer-list').then((m) => m.LayerListComponent),
  },
  {
    id: 'polygons',
    title: 'Polígonos',
    icon: 'polyline',
    tooltip: 'Graficar polígono',
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

/**
 * Menú principal con controles del mapa
 * Barra de botones flotante + panel lateral excluyente
 */
@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [
    CommonModule,
    NgComponentOutlet,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenuComponent {
  // Secciones disponibles del menú
  readonly sections = MENU_SECTIONS;

  // Panel activo (ID de la sección o null)
  readonly activePanel = signal<string | null>(null);

  // Componente del panel activo, resuelto perezosamente al abrir la sección.
  // Es null mientras el chunk se descarga (o cuando no hay panel abierto).
  readonly activeComponent = signal<Type<MenuPanelComponent> | null>(null);

  constructor() {
    // Eagerly prefetch every panel chunk as soon as the menu is created, so the
    // first open is always instant (no empty-panel flash) — rather than waiting
    // for an idle window that may be delayed. Chunks stay separate, so the
    // initial bundle (and TBT) is unaffected; they just download up front.
    for (const section of this.sections) {
      section.loadComponent().catch(() => {
        /* a failed prefetch is harmless — togglePanel will retry on open */
      });
    }
  }

  /**
   * Obtiene la sección activa
   */
  getActiveSection(): MenuSection | undefined {
    const activePanelId = this.activePanel();
    return this.sections.find((s) => s.id === activePanelId);
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

  /**
   * Cierra el panel actual
   */
  closePanel(): void {
    this.activePanel.set(null);
    this.activeComponent.set(null);
  }
}
