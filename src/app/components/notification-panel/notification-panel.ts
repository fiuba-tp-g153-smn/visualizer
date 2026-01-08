import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationType } from '../../models';

/**
 * Componente para mostrar notificaciones tipo toast
 */
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.scss',
})
export class NotificationPanelComponent {
  readonly notificationService = inject(NotificationService);
  readonly NotificationType = NotificationType;

  getIcon(type: NotificationType): string {
    switch (type) {
      case NotificationType.INFO:
        return 'ℹ';
      case NotificationType.WARNING:
        return '⚠';
      case NotificationType.ERROR:
        return '❌';
      case NotificationType.SUCCESS:
        return '✅';
    }
  }
}
