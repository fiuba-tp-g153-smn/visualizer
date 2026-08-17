import { Injectable, signal } from '@angular/core';
import { NotificationType, Notification } from '../../models';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly _notifications = signal<Notification[]>([]);
  /** Pending auto-close timers by notification id, so they can be cancelled. */
  private readonly autoCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();

  public readonly notifications = this._notifications.asReadonly();

  /**
   * Muestra una notificación.
   *
   * Si se provee `options.id`, la notificación es idempotente: cualquier
   * notificación previa con el mismo id es reemplazada (útil para banners
   * persistentes globales como "el servicio no está disponible").
   * Retorna el id efectivo para que el caller pueda invocar `dismiss(id)`.
   */
  show(
    type: NotificationType,
    message: string,
    options?: {
      id?: string;
      layerId?: string;
      autoClose?: boolean;
      duration?: number;
    },
  ): string {
    const id = options?.id ?? `${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      type,
      message,
      layerId: options?.layerId,
      timestamp: Date.now(),
      autoClose: options?.autoClose ?? true,
      duration: options?.duration ?? 5_000,
    };

    // Replacing an existing id: cancel its pending auto-close so we don't leave
    // an orphan timer (or a double timer) firing against the replacement.
    this.clearTimer(id);

    this._notifications.update((notifications) => [
      ...notifications.filter((n) => n.id !== id),
      notification,
    ]);

    if (notification.autoClose) {
      const handle = setTimeout(() => {
        this.autoCloseTimers.delete(notification.id);
        this.dismiss(notification.id);
      }, notification.duration);
      this.autoCloseTimers.set(id, handle);
    }
    return id;
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this._notifications.update((notifications) => notifications.filter((n) => n.id !== id));
  }

  dismissAll(): void {
    for (const handle of this.autoCloseTimers.values()) {
      clearTimeout(handle);
    }
    this.autoCloseTimers.clear();
    this._notifications.set([]);
  }

  private clearTimer(id: string): void {
    const handle = this.autoCloseTimers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.autoCloseTimers.delete(id);
    }
  }

  error(message: string, layerId?: string): string {
    return this.show(NotificationType.ERROR, message, {
      layerId,
      autoClose: false,
    });
  }

  warning(message: string, layerId?: string): string {
    return this.show(NotificationType.WARNING, message, {
      layerId,
      duration: 7_000,
    });
  }

  info(message: string): string {
    return this.show(NotificationType.INFO, message, { duration: 4_000 });
  }

  success(message: string): string {
    return this.show(NotificationType.SUCCESS, message, { duration: 3_000 });
  }
}
