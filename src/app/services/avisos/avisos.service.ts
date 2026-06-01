import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertsService } from '../polygons/alerts.service';
import { Aviso } from '../../models/geo';
import { toAviso } from '../../utils/aviso.utils';

/** Auto-refresh cadence for active alerts (matches layer auto-refresh). */
const AUTO_REFRESH_INTERVAL_MS = 10_000;

/**
 * Stateful service for active alerts ("avisos"). Owns the "show active" toggle,
 * the list of active avisos, manual/automatic refresh and expiry pruning.
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly alertsService = inject(AlertsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly showActiveSignal = signal<boolean>(false);
  private readonly avisosSignal = signal<ReadonlyArray<Aviso>>([]);
  private readonly loadingSignal = signal<boolean>(false);

  /** Whether active avisos should be shown/fetched. */
  readonly showActive = this.showActiveSignal.asReadonly();
  /** Current list of active avisos. */
  readonly avisos = this.avisosSignal.asReadonly();
  /** Whether a refresh request is in flight. */
  readonly loading = this.loadingSignal.asReadonly();

  /** Monotonic cursor: highest alert id ever seen, independent of pruning. */
  private lastSeenMaxId: number | undefined = undefined;
  private timerId: number | undefined = undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAutoRefresh());
  }

  /**
   * Enables or disables showing active avisos. Enabling triggers a full fetch
   * and starts auto-refresh; disabling clears state and stops polling.
   */
  setShowActive(on: boolean): void {
    if (on === this.showActiveSignal()) return;
    this.showActiveSignal.set(on);

    if (on) {
      this.lastSeenMaxId = undefined;
      void this.fetch(undefined);
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
      this.avisosSignal.set([]);
      this.lastSeenMaxId = undefined;
    }
  }

  /** Manual/automatic refresh: fetch new avisos since the cursor and prune expired. */
  async refresh(): Promise<void> {
    if (!this.showActiveSignal()) return;
    await this.fetch(this.lastSeenMaxId);
  }

  private async fetch(sinceId: number | undefined): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const responses = await firstValueFrom(this.alertsService.getAlerts(sinceId));
      const incoming = responses.map(toAviso);
      this.mergeAndPrune(incoming);
    } catch (error) {
      console.error('Error al obtener avisos activos:', error);
      // Still prune locally so expired avisos disappear even if the fetch failed.
      this.mergeAndPrune([]);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private mergeAndPrune(incoming: ReadonlyArray<Aviso>): void {
    const now = Date.now();
    const byId = new Map<number, Aviso>();

    for (const aviso of this.avisosSignal()) {
      byId.set(aviso.alertId, aviso);
    }
    for (const aviso of incoming) {
      byId.set(aviso.alertId, aviso);
      if (this.lastSeenMaxId === undefined || aviso.alertId > this.lastSeenMaxId) {
        this.lastSeenMaxId = aviso.alertId;
      }
    }

    const merged = Array.from(byId.values())
      .filter((aviso) => aviso.endDatetime.getTime() > now)
      .sort((a, b) => a.alertId - b.alertId);

    this.avisosSignal.set(merged);
  }

  private startAutoRefresh(): void {
    if (this.timerId !== undefined) return;
    this.timerId = window.setInterval(() => void this.refresh(), AUTO_REFRESH_INTERVAL_MS);
  }

  private stopAutoRefresh(): void {
    if (this.timerId !== undefined) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}
