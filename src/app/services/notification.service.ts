import { Injectable, signal } from '@angular/core';
import { Notification, NotificationType } from '../models/notification';

/**
 * Servicio para gestionar notificaciones en la UI
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly _notifications = signal<Notification[]>([]);

  /** Notificaciones activas (readonly) */
  public readonly notifications = this._notifications.asReadonly();

  /**
   * Muestra una notificación
   */
  show(
    type: NotificationType,
    message: string,
    options?: {
      layerId?: string;
      autoClose?: boolean;
      duration?: number;
    }
  ): void {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      layerId: options?.layerId,
      timestamp: Date.now(),
      autoClose: options?.autoClose ?? true,
      duration: options?.duration ?? 5000,
    };

    this._notifications.update((notifications) => [...notifications, notification]);

    // Auto-cerrar si está configurado
    if (notification.autoClose) {
      setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.duration);
    }
  }

  /**
   * Cierra una notificación
   */
  dismiss(id: string): void {
    this._notifications.update((notifications) => notifications.filter((n) => n.id !== id));
  }

  /**
   * Cierra todas las notificaciones
   */
  dismissAll(): void {
    this._notifications.set([]);
  }

  /**
   * Atajos para tipos comunes de notificaciones
   */
  error(message: string, layerId?: string): void {
    this.show(NotificationType.ERROR, message, {
      layerId,
      autoClose: false, // Los errores no se cierran automáticamente
    });
  }

  warning(message: string, layerId?: string): void {
    this.show(NotificationType.WARNING, message, {
      layerId,
      duration: 7000,
    });
  }

  info(message: string): void {
    this.show(NotificationType.INFO, message, { duration: 4000 });
  }

  success(message: string): void {
    this.show(NotificationType.SUCCESS, message, { duration: 3000 });
  }
}
