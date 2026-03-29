import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';

import { KeyboardShortcutsService } from '../../../../services/keyboard-shortcuts/keyboard-shortcuts.service';
import { MenuPanelComponent } from '../menu-section.model';
import {
  ShortcutCategory,
  SHORTCUT_CATEGORY_NAMES,
  SHORTCUT_CATEGORY_ICONS,
  formatKeyCombination,
} from '../../../../models';

/**
 * Orden de las categorías para mostrar en el panel
 */
const CATEGORY_ORDER: ShortcutCategory[] = [
  'navigation',
  'drawing',
  'layers',
  'playback',
  'tools',
  'general',
];

/**
 * Panel de configuración de atajos de teclado
 *
 * Permite:
 * - Activar/desactivar el sistema globalmente
 * - Activar/desactivar shortcuts individuales
 * - Ver las combinaciones de teclas
 * - Restaurar valores por defecto
 */
@Component({
  selector: 'app-keyboard-shortcuts-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    MatExpansionModule,
  ],
  templateUrl: './keyboard-shortcuts-panel.html',
  styleUrl: './keyboard-shortcuts-panel.scss',
})
export class KeyboardShortcutsPanelComponent implements MenuPanelComponent {
  readonly shortcutsService = inject(KeyboardShortcutsService);

  // Categorías ordenadas
  readonly categories = CATEGORY_ORDER;
  readonly categoryNames = SHORTCUT_CATEGORY_NAMES;
  readonly categoryIcons = SHORTCUT_CATEGORY_ICONS;

  // Panel expandido actual
  readonly expandedCategory = signal<ShortcutCategory | null>('navigation');

  /**
   * Obtiene los shortcuts de una categoría
   */
  getShortcutsForCategory(category: ShortcutCategory) {
    return this.shortcutsService.getAllShortcuts().filter((s) => s.category === category);
  }

  /**
   * Formatea la combinación de teclas para mostrar
   */
  formatKeys = formatKeyCombination;

  /**
   * Cuenta los shortcuts habilitados en una categoría
   */
  getEnabledCount(category: ShortcutCategory): number {
    return this.getShortcutsForCategory(category).filter((s) =>
      this.shortcutsService.isShortcutEnabled(s.id),
    ).length;
  }

  /**
   * Cuenta el total de shortcuts en una categoría
   */
  getTotalCount(category: ShortcutCategory): number {
    return this.getShortcutsForCategory(category).length;
  }

  /**
   * Toggle de un shortcut
   */
  onShortcutToggle(id: string, enabled: boolean): void {
    this.shortcutsService.setShortcutEnabled(id, enabled);
  }

  /**
   * Toggle del sistema global
   */
  onGlobalToggle(enabled: boolean): void {
    this.shortcutsService.setGlobalEnabled(enabled);
  }

  /**
   * Restaura los valores por defecto
   */
  onResetDefaults(): void {
    this.shortcutsService.resetToDefaults();
  }

  /**
   * Maneja la expansión de una categoría
   */
  onCategoryExpanded(category: ShortcutCategory): void {
    this.expandedCategory.set(category);
  }

  /**
   * Maneja el colapso de una categoría
   */
  onCategoryClosed(category: ShortcutCategory): void {
    if (this.expandedCategory() === category) {
      this.expandedCategory.set(null);
    }
  }

  onPanelOpen(): void {}

  onPanelClose(): void {}
}
