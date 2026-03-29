import { Injectable, signal, effect, PLATFORM_ID, inject, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, filter } from 'rxjs';
import {
  ShortcutDefinition,
  ShortcutState,
  PersistedShortcutsState,
  KeyCombination,
  ShortcutCategory,
  matchesKeyCombination,
} from '../../models';
import { SHORTCUTS_CONFIG, ShortcutId, SHORTCUT_IDS } from '../../config/keyboard-shortcuts.config';

const STORAGE_KEY = 'smn-keyboard-shortcuts-v1';
const CURRENT_VERSION = 1;

/**
 * Elementos de formulario donde no se deben activar shortcuts
 */
const INPUT_ELEMENTS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Keyboard Shortcuts Service
 *
 * Gestiona los atajos de teclado de la aplicación con:
 * - Activación/desactivación global e individual
 * - Persistencia en localStorage
 * - Event handling centralizado
 * - Prevención de conflictos con campos de formulario
 */
@Injectable({
  providedIn: 'root',
})
export class KeyboardShortcutsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  // Estado global del sistema de shortcuts
  private readonly _globalEnabled = signal<boolean>(true);
  readonly globalEnabled = this._globalEnabled.asReadonly();

  // Estado de cada shortcut individual
  private readonly _shortcutStates = signal<Map<string, boolean>>(this.loadStatesFromStorage());

  // Callbacks registrados para cada shortcut
  private readonly handlers = new Map<string, () => void>();

  constructor() {
    // Persistir cambios en localStorage
    effect(() => {
      this.saveStatesToStorage();
    });

    // Iniciar escucha de eventos de teclado
    if (isPlatformBrowser(this.platformId)) {
      this.initKeyboardListener();
    }
  }

  /**
   * Obtiene todas las definiciones de shortcuts
   */
  getAllShortcuts(): ReadonlyArray<ShortcutDefinition> {
    return SHORTCUTS_CONFIG;
  }

  /**
   * Obtiene shortcuts agrupados por categoría
   */
  getShortcutsByCategory(): Map<ShortcutCategory, ShortcutDefinition[]> {
    const grouped = new Map<ShortcutCategory, ShortcutDefinition[]>();

    for (const shortcut of SHORTCUTS_CONFIG) {
      const existing = grouped.get(shortcut.category) ?? [];
      grouped.set(shortcut.category, [...existing, shortcut]);
    }

    return grouped;
  }

  /**
   * Verifica si un shortcut está habilitado
   */
  isShortcutEnabled(id: string): boolean {
    return this._shortcutStates().get(id) ?? this.getDefaultState(id);
  }

  /**
   * Habilita o deshabilita un shortcut individual
   */
  setShortcutEnabled(id: string, enabled: boolean): void {
    const newStates = new Map(this._shortcutStates());
    newStates.set(id, enabled);
    this._shortcutStates.set(newStates);
  }

  /**
   * Toggle de un shortcut individual
   */
  toggleShortcut(id: string): void {
    this.setShortcutEnabled(id, !this.isShortcutEnabled(id));
  }

  /**
   * Habilita o deshabilita el sistema globalmente
   */
  setGlobalEnabled(enabled: boolean): void {
    this._globalEnabled.set(enabled);
    this.saveStatesToStorage();
  }

  /**
   * Toggle del sistema global
   */
  toggleGlobal(): void {
    this.setGlobalEnabled(!this._globalEnabled());
  }

  /**
   * Restaura todos los shortcuts a sus valores por defecto
   */
  resetToDefaults(): void {
    const defaultStates = new Map<string, boolean>();
    for (const shortcut of SHORTCUTS_CONFIG) {
      defaultStates.set(shortcut.id, shortcut.enabledByDefault);
    }
    this._shortcutStates.set(defaultStates);
    this._globalEnabled.set(true);
  }

  /**
   * Registra un handler para un shortcut
   * @returns Función para desregistrar el handler
   */
  registerHandler(id: ShortcutId, handler: () => void): () => void {
    this.handlers.set(id, handler);
    return () => this.handlers.delete(id);
  }

  /**
   * Registra múltiples handlers
   * @returns Función para desregistrar todos los handlers
   */
  registerHandlers(handlersMap: Partial<Record<ShortcutId, () => void>>): () => void {
    const unsubscribes: (() => void)[] = [];

    for (const [id, handler] of Object.entries(handlersMap)) {
      if (handler) {
        unsubscribes.push(this.registerHandler(id as ShortcutId, handler));
      }
    }

    return () => unsubscribes.forEach((unsub) => unsub());
  }

  /**
   * Obtiene el shortcut ID por combinación de teclas (para mostrar en tooltips)
   */
  getShortcutForKeyCombination(combo: KeyCombination): ShortcutDefinition | undefined {
    return SHORTCUTS_CONFIG.find(
      (s) =>
        s.keyCombination.key === combo.key &&
        JSON.stringify(s.keyCombination.modifiers) === JSON.stringify(combo.modifiers),
    );
  }

  /**
   * Obtiene un shortcut por ID
   */
  getShortcutById(id: string): ShortcutDefinition | undefined {
    return SHORTCUTS_CONFIG.find((s) => s.id === id);
  }

  /**
   * Inicializa el listener de eventos de teclado
   */
  private initKeyboardListener(): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        filter((event) => this.shouldProcessEvent(event)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.handleKeyDown(event));
  }

  /**
   * Verifica si un evento debe ser procesado
   */
  private shouldProcessEvent(event: KeyboardEvent): boolean {
    // Verificar si el sistema está habilitado globalmente
    if (!this._globalEnabled()) {
      return false;
    }

    // Ignorar eventos en campos de formulario
    const target = event.target as HTMLElement;
    if (INPUT_ELEMENTS.includes(target.tagName)) {
      return true; // Permitir ESC en inputs
    }

    // Ignorar si el elemento es editable
    if (target.isContentEditable) {
      return false;
    }

    return true;
  }

  /**
   * Maneja un evento keydown
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInInput = INPUT_ELEMENTS.includes(target.tagName) || target.isContentEditable;

    for (const shortcut of SHORTCUTS_CONFIG) {
      if (!this.isShortcutEnabled(shortcut.id)) {
        continue;
      }

      if (matchesKeyCombination(event, shortcut.keyCombination)) {
        // Solo permitir ESC en inputs
        if (isInInput && event.key !== 'Escape') {
          continue;
        }

        const handler = this.handlers.get(shortcut.id);
        if (handler) {
          event.preventDefault();
          event.stopPropagation();
          handler();
          return;
        }
      }
    }
  }

  /**
   * Obtiene el estado por defecto de un shortcut
   */
  private getDefaultState(id: string): boolean {
    const shortcut = SHORTCUTS_CONFIG.find((s) => s.id === id);
    return shortcut?.enabledByDefault ?? true;
  }

  /**
   * Carga los estados desde localStorage
   */
  private loadStatesFromStorage(): Map<string, boolean> {
    const states = new Map<string, boolean>();

    // Inicializar con valores por defecto
    for (const shortcut of SHORTCUTS_CONFIG) {
      states.set(shortcut.id, shortcut.enabledByDefault);
    }

    if (!isPlatformBrowser(this.platformId)) {
      return states;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const persisted: PersistedShortcutsState = JSON.parse(stored);

        // Verificar versión
        if (persisted.version === CURRENT_VERSION) {
          this._globalEnabled?.set(persisted.globalEnabled);

          for (const shortcutState of persisted.shortcuts) {
            // Solo aplicar si el shortcut sigue existiendo
            if (SHORTCUTS_CONFIG.some((s) => s.id === shortcutState.id)) {
              states.set(shortcutState.id, shortcutState.enabled);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load keyboard shortcuts state:', error);
    }

    return states;
  }

  /**
   * Guarda los estados en localStorage
   */
  private saveStatesToStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const persisted: PersistedShortcutsState = {
        version: CURRENT_VERSION,
        globalEnabled: this._globalEnabled(),
        shortcuts: Array.from(this._shortcutStates().entries()).map(([id, enabled]) => ({
          id,
          enabled,
        })),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch (error) {
      console.warn('Failed to save keyboard shortcuts state:', error);
    }
  }
}
