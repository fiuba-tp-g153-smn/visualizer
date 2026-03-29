import { ShortcutDefinition } from '../models';

/**
 * IDs de shortcuts para uso en el servicio
 */
export const SHORTCUT_IDS = {
  // Navegación
  OPEN_LAYERS_PANEL: 'open-layers-panel',
  OPEN_POLYGONS_PANEL: 'open-polygons-panel',
  OPEN_BASEMAPS_PANEL: 'open-basemaps-panel',
  OPEN_TOOLS_PANEL: 'open-tools-panel',
  OPEN_SHORTCUTS_PANEL: 'open-shortcuts-panel',
  CLOSE_PANEL: 'close-panel',

  // Dibujo
  START_DRAW_POLYGON: 'start-draw-polygon',
  CANCEL_DRAWING: 'cancel-drawing',
  START_EDIT_MODE: 'start-edit-mode',
  START_DELETE_MODE: 'start-delete-mode',

  // Capas
  TOGGLE_FIRST_LAYER: 'toggle-first-layer',
  TOGGLE_SECOND_LAYER: 'toggle-second-layer',
  TOGGLE_THIRD_LAYER: 'toggle-third-layer',
  TOGGLE_ALL_SCALES: 'toggle-all-scales',

  // Reproducción
  TOGGLE_PLAYBACK: 'toggle-playback',
  TOGGLE_SYNC_PLAYBACK: 'toggle-sync-playback',
  NEXT_FRAME: 'next-frame',
  PREV_FRAME: 'prev-frame',
  SPEED_UP: 'speed-up',
  SPEED_DOWN: 'speed-down',

  // Herramientas
  TOGGLE_COORDINATES: 'toggle-coordinates',
  TOGGLE_SCALE_BAR: 'toggle-scale-bar',

  // General
  SHOW_HELP: 'show-help',
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  RESET_VIEW: 'reset-view',
} as const;

export type ShortcutId = (typeof SHORTCUT_IDS)[keyof typeof SHORTCUT_IDS];

/**
 * Configuración de todos los atajos de teclado disponibles
 */
export const SHORTCUTS_CONFIG: ShortcutDefinition[] = [
  // === NAVEGACIÓN ===
  {
    id: SHORTCUT_IDS.OPEN_LAYERS_PANEL,
    name: 'Abrir panel de capas',
    description: 'Abre o cierra el panel de capas del mapa',
    category: 'navigation',
    keyCombination: { key: '1' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.OPEN_POLYGONS_PANEL,
    name: 'Abrir panel de polígonos',
    description: 'Abre o cierra el panel de gestión de polígonos',
    category: 'navigation',
    keyCombination: { key: '2' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.OPEN_BASEMAPS_PANEL,
    name: 'Abrir panel de mapa base',
    description: 'Abre o cierra el panel de selección de mapa base',
    category: 'navigation',
    keyCombination: { key: '3' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.OPEN_TOOLS_PANEL,
    name: 'Abrir herramientas',
    description: 'Abre o cierra el panel de herramientas del mapa',
    category: 'navigation',
    keyCombination: { key: '4' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.OPEN_SHORTCUTS_PANEL,
    name: 'Abrir atajos de teclado',
    description: 'Abre o cierra el panel de atajos de teclado',
    category: 'navigation',
    keyCombination: { key: '5' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.CLOSE_PANEL,
    name: 'Cerrar panel',
    description: 'Cierra el panel actualmente abierto',
    category: 'navigation',
    keyCombination: { key: 'Escape' },
    enabledByDefault: true,
  },

  // === DIBUJO ===
  {
    id: SHORTCUT_IDS.START_DRAW_POLYGON,
    name: 'Dibujar polígono',
    description: 'Inicia el modo de dibujo de polígonos',
    category: 'drawing',
    keyCombination: { key: 'd' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.CANCEL_DRAWING,
    name: 'Cancelar dibujo',
    description: 'Cancela el dibujo o edición actual',
    category: 'drawing',
    keyCombination: { key: 'Escape' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.START_EDIT_MODE,
    name: 'Modo edición',
    description: 'Activa el modo de edición de polígonos',
    category: 'drawing',
    keyCombination: { key: 'e' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.START_DELETE_MODE,
    name: 'Modo eliminación',
    description: 'Activa el modo de eliminación de polígonos',
    category: 'drawing',
    keyCombination: { key: 'x' },
    enabledByDefault: true,
  },

  // === CAPAS ===
  {
    id: SHORTCUT_IDS.TOGGLE_FIRST_LAYER,
    name: 'Toggle capa 1',
    description: 'Muestra u oculta la primera capa activa',
    category: 'layers',
    keyCombination: { key: 'q' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.TOGGLE_SECOND_LAYER,
    name: 'Toggle capa 2',
    description: 'Muestra u oculta la segunda capa activa',
    category: 'layers',
    keyCombination: { key: 'w' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.TOGGLE_THIRD_LAYER,
    name: 'Toggle capa 3',
    description: 'Muestra u oculta la tercera capa activa',
    category: 'layers',
    keyCombination: { key: 'r' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.TOGGLE_ALL_SCALES,
    name: 'Toggle escalas',
    description: 'Muestra u oculta todas las escalas de capas',
    category: 'layers',
    keyCombination: { key: 's' },
    enabledByDefault: true,
  },

  // === REPRODUCCIÓN ===
  {
    id: SHORTCUT_IDS.TOGGLE_PLAYBACK,
    name: 'Play/Pause',
    description: 'Reproduce o pausa la animación de la primera capa con playback',
    category: 'playback',
    keyCombination: { key: ' ' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.TOGGLE_SYNC_PLAYBACK,
    name: 'Play/Pause sincronizado',
    description: 'Reproduce o pausa la animación sincronizada de capas',
    category: 'playback',
    keyCombination: { key: ' ', modifiers: { shift: true } },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.NEXT_FRAME,
    name: 'Frame siguiente',
    description: 'Avanza al siguiente frame de la animación',
    category: 'playback',
    keyCombination: { key: 'ArrowRight' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.PREV_FRAME,
    name: 'Frame anterior',
    description: 'Retrocede al frame anterior de la animación',
    category: 'playback',
    keyCombination: { key: 'ArrowLeft' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.SPEED_UP,
    name: 'Aumentar velocidad',
    description: 'Aumenta la velocidad de reproducción',
    category: 'playback',
    keyCombination: { key: 'ArrowUp' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.SPEED_DOWN,
    name: 'Reducir velocidad',
    description: 'Reduce la velocidad de reproducción',
    category: 'playback',
    keyCombination: { key: 'ArrowDown' },
    enabledByDefault: true,
  },

  // === HERRAMIENTAS ===
  {
    id: SHORTCUT_IDS.TOGGLE_COORDINATES,
    name: 'Toggle coordenadas',
    description: 'Muestra u oculta el panel de coordenadas',
    category: 'tools',
    keyCombination: { key: 'c' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.TOGGLE_SCALE_BAR,
    name: 'Toggle barra de escala',
    description: 'Muestra u oculta la barra de escala del mapa',
    category: 'tools',
    keyCombination: { key: 'b' },
    enabledByDefault: true,
  },

  // === GENERAL ===
  {
    id: SHORTCUT_IDS.SHOW_HELP,
    name: 'Mostrar ayuda',
    description: 'Abre el panel de atajos de teclado',
    category: 'general',
    keyCombination: { key: '?' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.ZOOM_IN,
    name: 'Acercar',
    description: 'Aumenta el nivel de zoom del mapa',
    category: 'general',
    keyCombination: { key: '+' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.ZOOM_OUT,
    name: 'Alejar',
    description: 'Reduce el nivel de zoom del mapa',
    category: 'general',
    keyCombination: { key: '-' },
    enabledByDefault: true,
  },
  {
    id: SHORTCUT_IDS.RESET_VIEW,
    name: 'Vista inicial',
    description: 'Restaura la vista inicial del mapa',
    category: 'general',
    keyCombination: { key: '0' },
    enabledByDefault: true,
  },
];

/**
 * Obtiene un shortcut por su ID
 */
export function getShortcutById(id: string): ShortcutDefinition | undefined {
  return SHORTCUTS_CONFIG.find((s) => s.id === id);
}

/**
 * Obtiene shortcuts por categoría
 */
export function getShortcutsByCategory(
  category: ShortcutDefinition['category'],
): ShortcutDefinition[] {
  return SHORTCUTS_CONFIG.filter((s) => s.category === category);
}
