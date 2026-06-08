import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';

import { buildDataServiceHealthUrl } from '../../config';
import { NotificationType } from '../../models';
import { NotificationService } from '../notifications/notification.service';

/**
 * Hybrid availability tracker for the data-service.
 *
 * The service starts in the "available" state and only probes `/health`
 * when something else reports a failure (typically the tile-error path in
 * `LayerRenderService`). On a failed probe it:
 *   1. Sets `isAvailable()` to `false`.
 *   2. Shows a single, idempotent error banner via `NotificationService`.
 *   3. Starts polling `/health` every `POLL_INTERVAL_MS` until a 200 returns.
 *
 * On recovery the banner is dismissed and a short success toast is shown.
 *
 * The `isAvailable` signal lets other components suppress per-component
 * error toasts while the global banner is up, keeping the UI focused on
 * the actionable single message.
 */
@Injectable({
  providedIn: 'root',
})
export class DataServiceHealthService {
  private static readonly BANNER_ID = 'data-service-unavailable';
  private static readonly PROBE_TIMEOUT_MS = 3_000;
  private static readonly POLL_INTERVAL_MS = 10_000;
  private static readonly BANNER_MESSAGE =
    'El Caché y mapas no está disponible. Algunas capas pueden no cargar. Reintentando…';
  private static readonly RECOVERY_MESSAGE = 'Caché y mapas reconectado.';

  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  private readonly _isAvailable = signal<boolean>(true);
  public readonly isAvailable: Signal<boolean> = this._isAvailable.asReadonly();

  private probeInFlight = false;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Called by other services when they observe a failure that might
   * indicate the data-service is down. Debounces concurrent probes; while
   * a probe is in flight or polling is active, repeated calls are no-ops.
   */
  reportFailure(): void {
    if (this.probeInFlight || this.pollHandle !== null) {
      return;
    }
    void this.probeOnce();
  }

  private async probeOnce(): Promise<void> {
    this.probeInFlight = true;
    try {
      await firstValueFrom(
        this.http
          .get(buildDataServiceHealthUrl(), { responseType: 'text' })
          .pipe(timeout(DataServiceHealthService.PROBE_TIMEOUT_MS)),
      );
      this.markAvailable();
    } catch {
      this.markUnavailable();
    } finally {
      this.probeInFlight = false;
    }
  }

  private markUnavailable(): void {
    const wasAvailable = this._isAvailable();
    this._isAvailable.set(false);
    if (wasAvailable) {
      // Idempotent: show() with our stable id replaces any prior banner.
      this.notificationService.show(
        NotificationType.ERROR,
        DataServiceHealthService.BANNER_MESSAGE,
        { id: DataServiceHealthService.BANNER_ID, autoClose: false },
      );
    }
    this.startPolling();
  }

  private markAvailable(): void {
    const wasDown = !this._isAvailable();
    this._isAvailable.set(true);
    this.stopPolling();
    if (wasDown) {
      this.notificationService.dismiss(DataServiceHealthService.BANNER_ID);
      this.notificationService.success(DataServiceHealthService.RECOVERY_MESSAGE);
    }
  }

  private startPolling(): void {
    if (this.pollHandle !== null) {
      return;
    }
    this.pollHandle = setInterval(
      () => void this.probeOnce(),
      DataServiceHealthService.POLL_INTERVAL_MS,
    );
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

}
