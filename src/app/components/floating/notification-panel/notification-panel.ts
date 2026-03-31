import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../../../services/notifications/notification.service';
import { NotificationType } from '../../../models';

/**
 * Componente para mostrar notificaciones tipo toast
 */
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.scss',
})
export class NotificationPanelComponent {
  readonly notificationService = inject(NotificationService);
  readonly NotificationType = NotificationType;

  constructor() {}

  getIcon(type: NotificationType): string {
    switch (type) {
      case NotificationType.INFO:
        return 'info';
      case NotificationType.WARNING:
        return 'warning';
      case NotificationType.ERROR:
        return 'error';
      case NotificationType.SUCCESS:
        return 'check_circle';
    }
  }
}
