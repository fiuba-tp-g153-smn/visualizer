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
  },
  aria: {
    loading: 'Cargando',
    closePanel: 'Cerrar panel',
    closeNotification: 'Cerrar notificación',
  },
} as const;
