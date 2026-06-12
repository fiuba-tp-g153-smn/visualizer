import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DepartmentIntersectionService } from '../polygons/department-intersection.service';
import { ActiveAlert, AlertsVisibility, Department } from '../../models/geo';
import { toActiveAlert } from '../../utils/active-alert.utils';
import { LocalStorageService } from '../storage/local-storage.service';
import { STORAGE_KEYS } from '../../constants';

/** Auto-refresh cadence for active alerts (matches layer auto-refresh). */
const AUTO_REFRESH_INTERVAL_MS = 10_000;

/**
 * Stateful service for active alerts. Owns the "show active" toggle, the list of
 * active alerts, manual/automatic refresh and expiry pruning.
 */
@Injectable({ providedIn: 'root' })
export class ActiveAlertsService {
  private readonly departmentIntersectionService = inject(DepartmentIntersectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(LocalStorageService);

  private readonly showActiveSignal = signal<boolean>(
    this.storage.getJson<AlertsVisibility>(STORAGE_KEYS.ALERTS_VISIBILITY)?.active ?? false,
  );
  private readonly activeAlertsSignal = signal<ReadonlyArray<ActiveAlert>>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly shownDepartmentsSignal = signal<ReadonlyArray<Department>>([]);
  private readonly shownDepartmentsAlertSignal = signal<ActiveAlert | null>(null);
  private readonly hoveredDepartmentsSignal = signal<ReadonlyArray<string>>([]);
  private readonly hiddenIdsSignal = signal<ReadonlySet<number>>(new Set());

  readonly showActive = this.showActiveSignal.asReadonly();
  readonly activeAlerts = this.activeAlertsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly shownDepartments = this.shownDepartmentsSignal.asReadonly();
  readonly shownDepartmentsAlert = this.shownDepartmentsAlertSignal.asReadonly();
  readonly hoveredDepartments = this.hoveredDepartmentsSignal.asReadonly();
  readonly hiddenIds = this.hiddenIdsSignal.asReadonly();

  /** Monotonic cursor: highest alert id ever seen, independent of pruning. */
  private lastSeenMaxId: number | undefined = undefined;
  private timerId: number | undefined = undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAutoRefresh());

    if (this.showActiveSignal()) {
      void this.fetch(undefined);
      this.startAutoRefresh();
    }
  }

  setShowActive(on: boolean): void {
    if (on === this.showActiveSignal()) return;
    this.showActiveSignal.set(on);
    const visibility = this.storage.getJson<AlertsVisibility>(STORAGE_KEYS.ALERTS_VISIBILITY);
    this.storage.setJson<AlertsVisibility>(STORAGE_KEYS.ALERTS_VISIBILITY, {
      active: on,
      pending: visibility?.pending ?? false,
    });

    if (on) {
      this.lastSeenMaxId = undefined;
      void this.fetch(undefined);
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
      this.activeAlertsSignal.set([]);
      this.lastSeenMaxId = undefined;
      this.hiddenIdsSignal.set(new Set());
      this.hideDepartments();
    }
  }

  toggleHidden(alertId: number): void {
    const next = new Set(this.hiddenIdsSignal());
    if (next.has(alertId)) {
      next.delete(alertId);
    } else {
      next.add(alertId);
    }
    this.hiddenIdsSignal.set(next);
  }

  async showDepartments(alert: ActiveAlert): Promise<void> {
    this.shownDepartmentsAlertSignal.set(alert);
    try {
      const response = await firstValueFrom(
        this.departmentIntersectionService.intersectDepartments([...alert.coordinates]),
      );
      this.shownDepartmentsSignal.set(response.departments);
    } catch (error) {
      console.error('Error al cargar departamentos de la alerta:', error);
      this.shownDepartmentsSignal.set([]);
    }
  }

  hideDepartments(): void {
    this.shownDepartmentsSignal.set([]);
    this.shownDepartmentsAlertSignal.set(null);
    this.hoveredDepartmentsSignal.set([]);
  }

  setHoveredDepartment(name: string): void {
    this.hoveredDepartmentsSignal.set([name]);
  }

  /** Highlights several departments at once (e.g. hovering a whole province). */
  setHoveredDepartments(names: ReadonlyArray<string>): void {
    this.hoveredDepartmentsSignal.set(names);
  }

  clearHoveredDepartment(): void {
    this.hoveredDepartmentsSignal.set([]);
  }

  async refresh(): Promise<void> {
    if (!this.showActiveSignal()) return;
    await this.fetch(this.lastSeenMaxId);
  }

  private async fetch(sinceId: number | undefined): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const responses = await firstValueFrom(this.departmentIntersectionService.getAlerts(sinceId));
      const incoming = responses.map(toActiveAlert);
      this.mergeAndPrune(incoming);
    } catch (error) {
      console.error('Error al obtener avisos activos:', error);
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
