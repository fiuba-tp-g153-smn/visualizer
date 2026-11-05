/**
 * Texts shared by several features: generic actions, loading and empty states.
 * Feature-specific copy lives in its own `*.texts.ts`.
 */
export const COMMON_TEXTS = {
  actions: {
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    delete: 'Eliminar',
    retry: 'Reintentar',
    save: 'Guardar',
    show: 'Mostrar',
    hide: 'Ocultar',
    openInNewTab: 'Abrir en pestaña nueva',
  },
  errors: {
    serviceDown: 'el servicio no responde',
    httpStatus: (status: number): string => `el servicio respondió HTTP ${status}`,
    unknown: 'error desconocido',
  },
  aria: {
    loading: 'Cargando',
    closePanel: 'Cerrar panel',
    closeNotification: 'Cerrar notificación',
  },
} as const;
