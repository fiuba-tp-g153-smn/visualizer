import { Component, signal } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LayerListComponent } from './layer-list/layer-list';
import { BaseMapSelectorComponent } from './base-map-selector/base-map-selector';
import { PolygonManagerComponent } from './polygon-manager/polygon-manager';
import { MapToolsComponent } from './map-tools/tools';
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
    id: 'polygons',
    title: 'Polígonos',
    icon: 'polyline',
    tooltip: 'Gestionar polígonos',
    component: PolygonManagerComponent,
  },
  {
    id: 'basemaps',
    title: 'Mapa Base',
    icon: 'map',
    tooltip: 'Seleccionar mapa base',
    component: BaseMapSelectorComponent,
  },
  {
    id: 'map-tools',
    title: 'Herramientas del mapa',
    icon: 'handyman',
    tooltip: 'Herramientas del mapa',
    component: MapToolsComponent,
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

  constructor() {}

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
