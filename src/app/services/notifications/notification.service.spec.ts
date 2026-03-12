import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { NotificationType } from '../../models';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  describe('Initial state', () => {
    it('should start with no notifications', () => {
      expect(service.notifications()).toEqual([]);
    });
  });

  describe('show()', () => {
    it('should add a notification', () => {
      service.show(NotificationType.INFO, 'Test message');

      const notifications = service.notifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe('Test message');
      expect(notifications[0].type).toBe(NotificationType.INFO);
    });

    it('should add notification with layer ID', () => {
      service.show(NotificationType.ERROR, 'Layer error', {
        layerId: 'abi-ch13',
      });

      const notification = service.notifications()[0];
      expect(notification.layerId).toBe('abi-ch13');
    });

    it('should auto-close notification after duration', async () => {
      vi.useFakeTimers();

      service.show(NotificationType.INFO, 'Auto-close test', {
        autoClose: true,
        duration: 1000,
      });

      expect(service.notifications()).toHaveLength(1);

      vi.advanceTimersByTime(1000);
      await Promise.resolve(); // Wait for async updates

      expect(service.notifications()).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should not auto-close when disabled', async () => {
      vi.useFakeTimers();

      service.show(NotificationType.ERROR, 'No auto-close', {
        autoClose: false,
      });

      expect(service.notifications()).toHaveLength(1);

      vi.advanceTimersByTime(10000);
      await Promise.resolve();

      expect(service.notifications()).toHaveLength(1);

      vi.useRealTimers();
    });
  });

  describe('dismiss()', () => {
    it('should remove specific notification', () => {
      service.show(NotificationType.INFO, 'Message 1');
      service.show(NotificationType.INFO, 'Message 2');

      const notifications = service.notifications();
      expect(notifications).toHaveLength(2);

      service.dismiss(notifications[0].id);

      expect(service.notifications()).toHaveLength(1);
      expect(service.notifications()[0].message).toBe('Message 2');
    });
  });

  describe('dismissAll()', () => {
    it('should remove all notifications', () => {
      service.show(NotificationType.INFO, 'Message 1');
      service.show(NotificationType.WARNING, 'Message 2');
      service.show(NotificationType.ERROR, 'Message 3');

      expect(service.notifications()).toHaveLength(3);

      service.dismissAll();

      expect(service.notifications()).toHaveLength(0);
    });
  });

  describe('Shortcut methods', () => {
    it('error() should create error notification without auto-close', () => {
      service.error('Error message', 'abi-ch13');

      const notification = service.notifications()[0];
      expect(notification.type).toBe(NotificationType.ERROR);
      expect(notification.message).toBe('Error message');
      expect(notification.layerId).toBe('abi-ch13');
      expect(notification.autoClose).toBe(false);
    });

    it('warning() should create warning notification', () => {
      service.warning('Warning message');

      const notification = service.notifications()[0];
      expect(notification.type).toBe(NotificationType.WARNING);
      expect(notification.message).toBe('Warning message');
    });

    it('info() should create info notification', () => {
      service.info('Info message');

      const notification = service.notifications()[0];
      expect(notification.type).toBe(NotificationType.INFO);
    });

    it('success() should create success notification', () => {
      service.success('Success message');

      const notification = service.notifications()[0];
      expect(notification.type).toBe(NotificationType.SUCCESS);
    });
  });
});
