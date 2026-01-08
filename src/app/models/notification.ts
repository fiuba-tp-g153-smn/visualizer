/**
 * Tipos de notificaciones
 */
export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

/**
 * Modelo de notificación
 */
export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  layerId?: string; // ID de la capa relacionada (opcional)
  timestamp: number;
  autoClose?: boolean; // Si se cierra automáticamente
  duration?: number; // Duración en ms antes de auto-cerrar
}
