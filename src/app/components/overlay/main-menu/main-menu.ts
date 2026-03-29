import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
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
import { KeyboardShortcutsPanelComponent } from './keyboard-shortcuts-panel/keyboard-shortcuts-panel';
import { MenuSection } from './menu-section.model';
import { KeyboardShortcutsService } from '../../../services/keyboard-shortcuts/keyboard-shortcuts.service';
import { SHORTCUT_IDS } from '../../../config/keyboard-shortcuts.config';
import { formatKeyCombination } from '../../../models';

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
  {
    id: 'shortcuts',
    title: 'Atajos de teclado',
    icon: 'keyboard',
    tooltip: 'Atajos de teclado',
    component: KeyboardShortcutsPanelComponent,
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
export class MainMenuComponent implements OnInit, OnDestroy {
  private readonly shortcutsService = inject(KeyboardShortcutsService);

  // Secciones disponibles del menú
  readonly sections = MENU_SECTIONS;

  // Panel activo (ID de la sección o null)
  readonly activePanel = signal<string | null>(null);

  // Unsubscribe de handlers
  private unsubscribeHandlers: (() => void) | null = null;

  ngOnInit(): void {
    this.registerShortcutHandlers();
  }

  ngOnDestroy(): void {
    this.unsubscribeHandlers?.();
  }

  /**
   * Registra los handlers de shortcuts para navegación de paneles
   */
  private registerShortcutHandlers(): void {
    this.unsubscribeHandlers = this.shortcutsService.registerHandlers({
      [SHORTCUT_IDS.OPEN_LAYERS_PANEL]: () => this.togglePanel('layers'),
      [SHORTCUT_IDS.OPEN_POLYGONS_PANEL]: () => this.togglePanel('polygons'),
      [SHORTCUT_IDS.OPEN_BASEMAPS_PANEL]: () => this.togglePanel('basemaps'),
      [SHORTCUT_IDS.OPEN_TOOLS_PANEL]: () => this.togglePanel('map-tools'),
      [SHORTCUT_IDS.OPEN_SHORTCUTS_PANEL]: () => this.togglePanel('shortcuts'),
      [SHORTCUT_IDS.SHOW_HELP]: () => this.togglePanel('shortcuts'),
      [SHORTCUT_IDS.CLOSE_PANEL]: () => this.closePanel(),
    });
  }

  /**
   * Obtiene el tooltip con shortcut para una sección
   */
  getTooltipWithShortcut(section: MenuSection): string {
    const shortcutMap: Record<string, string> = {
      layers: SHORTCUT_IDS.OPEN_LAYERS_PANEL,
      polygons: SHORTCUT_IDS.OPEN_POLYGONS_PANEL,
      basemaps: SHORTCUT_IDS.OPEN_BASEMAPS_PANEL,
      'map-tools': SHORTCUT_IDS.OPEN_TOOLS_PANEL,
      shortcuts: SHORTCUT_IDS.OPEN_SHORTCUTS_PANEL,
    };

    const shortcutId = shortcutMap[section.id];
    if (shortcutId) {
      const shortcut = this.shortcutsService.getShortcutById(shortcutId);
      if (shortcut && this.shortcutsService.isShortcutEnabled(shortcutId)) {
        return `${section.tooltip} (${formatKeyCombination(shortcut.keyCombination)})`;
      }
    }
    return section.tooltip;
  }

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
