import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertsService } from '../polygons/alerts.service';
import { ActiveAlert, Department } from '../../models/geo';
import { toActiveAlert } from '../../utils/active-alert.utils';
import { DEPARTMENTS_SIMPLIFICATION_LEVEL } from '../../config/polygon.config';

/** Auto-refresh cadence for active alerts (matches layer auto-refresh). */
const AUTO_REFRESH_INTERVAL_MS = 10_000;

/**
 * Stateful service for active alerts. Owns the "show active" toggle, the list of
 * active alerts, manual/automatic refresh and expiry pruning.
 */
@Injectable({ providedIn: 'root' })
export class ActiveAlertsService {
  private readonly alertsService = inject(AlertsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly showActiveSignal = signal<boolean>(false);
  private readonly activeAlertsSignal = signal<ReadonlyArray<ActiveAlert>>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly shownDepartmentsSignal = signal<ReadonlyArray<Department>>([]);
  private readonly hoveredDepartmentSignal = signal<string | null>(null);

  /** Whether active alerts should be shown/fetched. */
  readonly showActive = this.showActiveSignal.asReadonly();
  /** Current list of active alerts. */
  readonly activeAlerts = this.activeAlertsSignal.asReadonly();
  /** Whether a refresh request is in flight. */
  readonly loading = this.loadingSignal.asReadonly();
  /** Departments (with geometry) of the alert whose menu is currently open. */
  readonly shownDepartments = this.shownDepartmentsSignal.asReadonly();
  /** Name of the department currently hovered in the open list. */
  readonly hoveredDepartment = this.hoveredDepartmentSignal.asReadonly();

  /** Monotonic cursor: highest alert id ever seen, independent of pruning. */
  private lastSeenMaxId: number | undefined = undefined;
  private timerId: number | undefined = undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAutoRefresh());
  }

  /**
   * Enables or disables showing active alerts. Enabling triggers a full fetch
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
      this.activeAlertsSignal.set([]);
      this.lastSeenMaxId = undefined;
      this.hideDepartments();
    }
  }

  /**
   * Loads (with geometry) and shows the affected departments of an alert on the
   * map, by intersecting its polygon against the departments layer.
   */
  async showDepartments(alert: ActiveAlert): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.alertsService.intersectDepartments(
          [...alert.coordinates],
          DEPARTMENTS_SIMPLIFICATION_LEVEL,
        ),
      );
      this.shownDepartmentsSignal.set(response.departments);
    } catch (error) {
      console.error('Error al cargar departamentos de la alerta:', error);
      this.shownDepartmentsSignal.set([]);
    }
  }

  /** Hides the affected departments from the map. */
  hideDepartments(): void {
    this.shownDepartmentsSignal.set([]);
    this.hoveredDepartmentSignal.set(null);
  }

  /** Marks a department (by name) as hovered to highlight it on the map. */
  setHoveredDepartment(name: string): void {
    this.hoveredDepartmentSignal.set(name);
  }

  /** Clears the hovered department highlight. */
  clearHoveredDepartment(): void {
    this.hoveredDepartmentSignal.set(null);
  }

  /** Manual/automatic refresh: fetch new alerts since the cursor and prune expired. */
  async refresh(): Promise<void> {
    if (!this.showActiveSignal()) return;
    await this.fetch(this.lastSeenMaxId);
  }

  private async fetch(sinceId: number | undefined): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const responses = await firstValueFrom(this.alertsService.getAlerts(sinceId));
      const incoming = responses.map(toActiveAlert);
      this.mergeAndPrune(incoming);
    } catch (error) {
      console.error('Error al obtener alertas activas:', error);
      // Still prune locally so expired alerts disappear even if the fetch failed.
      this.mergeAndPrune([]);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private mergeAndPrune(incoming: ReadonlyArray<ActiveAlert>): void {
    const now = Date.now();
    const byId = new Map<number, ActiveAlert>();

    for (const alert of this.activeAlertsSignal()) {
      byId.set(alert.alertId, alert);
    }
    for (const alert of incoming) {
      byId.set(alert.alertId, alert);
      if (this.lastSeenMaxId === undefined || alert.alertId > this.lastSeenMaxId) {
        this.lastSeenMaxId = alert.alertId;
      }
    }

    const merged = Array.from(byId.values())
      .filter((alert) => alert.endDatetime.getTime() > now)
      .sort((a, b) => a.alertId - b.alertId);

    this.activeAlertsSignal.set(merged);
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
