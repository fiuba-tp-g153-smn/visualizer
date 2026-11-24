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
      title: 'Visualizador SMN (versión experimental) — Mapa meteorológico interactivo',
      description:
        'Versión experimental en fase de prueba, no abierta al público. Visualizador del SMN: satélite GOES-19, radar, modelos de pronóstico y estaciones en Argentina.',
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
  experimental: {
    badge: 'Versión experimental · Uso interno',
    badgeHint: 'Ver el aviso sobre esta versión',
    title: 'Versión experimental',
    message:
      'Este visualizador es un desarrollo experimental en fase de prueba y no está abierto al público. No es un producto oficial del Servicio Meteorológico Nacional ni debe utilizarse para la toma de decisiones.',
    accept: 'Entendido',
  },
  aria: {
    loading: 'Cargando',
    closePanel: 'Cerrar panel',
    closeNotification: 'Cerrar notificación',
  },
} as const;
