import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DepartmentIntersectionService } from '../polygons/department-intersection.service';
import { ActiveAlert, AlertsVisibility, Department, DepartmentRef } from '../../models/geo';
import { toActiveAlert } from '../../utils/active-alert.utils';
import { LocalStorageService } from '../storage/local-storage.service';
import { STORAGE_KEYS } from '../../constants';

/** Auto-refresh cadence for active alerts (matches layer auto-refresh). */
const AUTO_REFRESH_INTERVAL_MS = 10_000;

/**
 * How often (in refreshes) to do a full reconcile instead of an incremental
 * `since_id` fetch. The incremental cursor only surfaces *new* alert ids, so a
 * periodic authoritative fetch is needed to reflect alerts the backend edited or
 * cancelled. At the 10 s cadence, 6 ≈ one full reconcile per minute.
 */
export const FULL_RECONCILE_EVERY = 6;

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
  private readonly hoveredDepartmentsSignal = signal<ReadonlyArray<DepartmentRef>>([]);
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
  /** Guards against overlapping manual/auto fetches racing the loading flag. */
  private fetchInFlight = false;
  /** Counts refreshes to schedule a periodic full reconcile (see FULL_RECONCILE_EVERY). */
  private refreshCount = 0;

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
      this.refreshCount = 0;
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
      // Discard a stale response if the user closed/switched the departments
      // view (or the alert expired) while this request was in flight.
      if (this.shownDepartmentsAlertSignal()?.alertId !== alert.alertId) return;
      this.shownDepartmentsSignal.set(response.departments);
    } catch (error) {
      console.error('Error al cargar departamentos de la alerta:', error);
      if (this.shownDepartmentsAlertSignal()?.alertId !== alert.alertId) return;
      this.shownDepartmentsSignal.set([]);
    }
  }

  hideDepartments(): void {
    this.shownDepartmentsSignal.set([]);
    this.shownDepartmentsAlertSignal.set(null);
    this.hoveredDepartmentsSignal.set([]);
  }

  setHoveredDepartment(department: DepartmentRef): void {
    this.hoveredDepartmentsSignal.set([department]);
  }

  /** Highlights several departments at once (e.g. hovering a whole province). */
  setHoveredDepartments(departments: ReadonlyArray<DepartmentRef>): void {
    this.hoveredDepartmentsSignal.set(departments);
  }

  clearHoveredDepartment(): void {
    this.hoveredDepartmentsSignal.set([]);
  }

  async refresh(): Promise<void> {
    if (!this.showActiveSignal()) return;
    // Every FULL_RECONCILE_EVERY-th refresh fetches the full list (no since_id)
    // and treats it as authoritative, so alerts the backend edited or cancelled
    // are reflected — the incremental cursor alone never sees them.
    this.refreshCount += 1;
    const reconcile = this.refreshCount % FULL_RECONCILE_EVERY === 0;
    await this.fetch(reconcile ? undefined : this.lastSeenMaxId, reconcile);
  }

  private async fetch(sinceId: number | undefined, reconcile = false): Promise<void> {
    // Skip if a fetch is already running so overlapping manual/auto refreshes
    // don't interleave or flip the loading flag early.
    if (this.fetchInFlight) return;
    this.fetchInFlight = true;
    this.loadingSignal.set(true);
    try {
      const responses = await firstValueFrom(this.departmentIntersectionService.getAlerts(sinceId));
      const incoming = responses.map(toActiveAlert);
      this.mergeAndPrune(incoming, reconcile);
    } catch (error) {
      console.error('Error al obtener avisos activos:', error);
      // Prune locally so expired alerts disappear, but never reconcile the list
      // away on a failed fetch (an empty error result must not wipe everything).
      this.mergeAndPrune([], false);
    } finally {
      this.loadingSignal.set(false);
      this.fetchInFlight = false;
    }
  }

  private mergeAndPrune(incoming: ReadonlyArray<ActiveAlert>, reconcile: boolean): void {
    const now = Date.now();
    const byId = new Map<number, ActiveAlert>();

    // On a full reconcile the incoming list is authoritative — don't carry prior
    // alerts forward, so backend-removed ones drop out instead of lingering.
    if (!reconcile) {
      for (const alert of this.activeAlertsSignal()) {
        byId.set(alert.alertId, alert);
      }
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

    const shownAlertId = this.shownDepartmentsAlertSignal()?.alertId;
    if (shownAlertId !== undefined && !merged.some((alert) => alert.alertId === shownAlertId)) {
      this.hideDepartments();
    }
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
