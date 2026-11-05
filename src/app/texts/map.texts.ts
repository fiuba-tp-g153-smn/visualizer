/** Texts for map-level UI: context menus, map aids, tools and sync playback. */
export const MAP_TEXTS = {
  contextMenu: {
    ariaLabel: 'Acciones sobre el mapa',
  },
  syncTimeline: {
    title: (group: string): string => `Línea de tiempo · ${group}`,
    deleteShortcut: 'Supr',
    unlink: 'Borrar conexión',
    done: 'Listo',
    frameCount: (count: number): string => `${count} cuadros`,
    laneTooltip: (name: string, included: boolean): string =>
      name + (included ? ' · desmarcá para desincronizar' : ' · marcá para sincronizar'),
    imageCountTooltip: 'Cambiarla vuelve a la combinación automática',
    images: 'Imágenes',
    imageCountAria: 'Cantidad de imágenes',
    clearAll: 'Borrar todas',
    reset: 'Restablecer',
    hint: 'Clic en puntos de distintas capas para unirlos en un cuadro',
    crossing: (layer: string): string =>
      `Cruza otro cuadro en ${layer}: ninguna capa puede volver atrás`,
    addPoints: 'Clic en puntos de otras capas para sumarlos',
    frame: (n: number, time: string): string => `Cuadro ${n} · ${time}`,
    /** Why a layer of the group sits outside its timeline, under its greyed-out lane. */
    leftOut: {
      unaligned: 'sin horarios en común',
      excluded: 'no sincronizada',
      waiting: 'sin sincronizar',
      enrolled: '',
    },
  },
  searchResultMenu: {
    clearMarker: 'Quitar marca del mapa',
  },
} as const;
