/**
 * Categorías de atajos de teclado
 */
export type ShortcutCategory =
  | 'navigation'
  | 'drawing'
  | 'layers'
  | 'playback'
  | 'tools'
  | 'general';

/**
 * Modificadores de teclas
 */
export interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Combinación de teclas para un shortcut
 */
export interface KeyCombination {
  key: string;
  modifiers?: KeyModifiers;
}

/**
 * Definición de un atajo de teclado
 */
export interface ShortcutDefinition {
  /** Identificador único del shortcut */
  id: string;
  /** Nombre descriptivo para mostrar en UI */
  name: string;
  /** Descripción detallada de la acción */
  description: string;
  /** Categoría del shortcut */
  category: ShortcutCategory;
  /** Combinación de teclas */
  keyCombination: KeyCombination;
  /** Habilitado por defecto */
  enabledByDefault: boolean;
}

/**
 * Estado de un shortcut individual
 */
export interface ShortcutState {
  /** Identificador del shortcut */
  id: string;
  /** Si está habilitado */
  enabled: boolean;
}

/**
 * Estado persistido de shortcuts
 */
export interface PersistedShortcutsState {
  /** Versión del schema para migraciones */
  version: number;
  /** Si el sistema de shortcuts está globalmente habilitado */
  globalEnabled: boolean;
  /** Estado individual de cada shortcut */
  shortcuts: ShortcutState[];
}

/**
 * Nombres de categorías para UI
 */
export const SHORTCUT_CATEGORY_NAMES: Record<ShortcutCategory, string> = {
  navigation: 'Navegación',
  drawing: 'Dibujo',
  layers: 'Capas',
  playback: 'Reproducción',
  tools: 'Herramientas',
  general: 'General',
} as const;

/**
 * Iconos de categorías para UI
 */
export const SHORTCUT_CATEGORY_ICONS: Record<ShortcutCategory, string> = {
  navigation: 'explore',
  drawing: 'edit',
  layers: 'layers',
  playback: 'play_arrow',
  tools: 'handyman',
  general: 'settings',
} as const;

/**
 * Formatea una combinación de teclas para mostrar en UI
 */
export function formatKeyCombination(combo: KeyCombination): string {
  const parts: string[] = [];

  if (combo.modifiers?.ctrl) {
    parts.push('Ctrl');
  }
  if (combo.modifiers?.alt) {
    parts.push('Alt');
  }
  if (combo.modifiers?.shift) {
    parts.push('Shift');
  }
  if (combo.modifiers?.meta) {
    parts.push('⌘');
  }

  // Normalizar nombre de tecla para display
  const keyDisplay = formatKeyName(combo.key);
  parts.push(keyDisplay);

  return parts.join(' + ');
}

/**
 * Formatea el nombre de una tecla para display
 */
function formatKeyName(key: string): string {
  const keyMappings: Record<string, string> = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: 'Enter',
    Backspace: '⌫',
    Delete: 'Del',
    Tab: 'Tab',
  };

  return keyMappings[key] ?? key.toUpperCase();
}

/**
 * Compara si un evento de teclado coincide con una combinación
 */
export function matchesKeyCombination(event: KeyboardEvent, combo: KeyCombination): boolean {
  const modifiers = combo.modifiers ?? {};

  const ctrlMatch = !!modifiers.ctrl === (event.ctrlKey || event.metaKey);
  const altMatch = !!modifiers.alt === event.altKey;
  const shiftMatch = !!modifiers.shift === event.shiftKey;

  const keyMatch = event.key.toLowerCase() === combo.key.toLowerCase();

  return ctrlMatch && altMatch && shiftMatch && keyMatch;
}
