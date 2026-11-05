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
  seo: {
    siteName: 'Visualizador SMN',
    default: {
      title: 'Visualizador SMN — Mapa meteorológico interactivo',
      description:
        'Visualizador interactivo del Servicio Meteorológico Nacional: imágenes satelitales GOES-19, radar meteorológico, modelos de pronóstico y estaciones en Argentina.',
    },
    status: {
      title: 'Estado del sistema — Visualizador SMN',
      description:
        'Estado operativo del Visualizador SMN: salud del procesamiento de datos, caché de mapas base y disponibilidad de los proveedores de mapas.',
    },
    docs: {
      title: 'Documentación — Visualizador SMN',
      description:
        'Documentación del Visualizador SMN: guías de uso, capas disponibles y referencia técnica de la plataforma meteorológica del SMN.',
    },
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
