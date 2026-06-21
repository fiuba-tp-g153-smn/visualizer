import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DepartmentIntersectionService } from '../polygons/department-intersection.service';
import { AlertsVisibility, Department, DepartmentRef, PendingAlert } from '../../models/geo';
import { toPendingAlert } from '../../utils/active-alert.utils';
import { environment } from '../../../environments/environment';
import { LocalStorageService } from '../storage/local-storage.service';
import { STORAGE_KEYS } from '../../constants';

/** Auto-refresh cadence for pending alerts (matches active alerts). */
const AUTO_REFRESH_INTERVAL_MS = 10_000;

/**
 * Stateful service for pending alerts (emitted via POST /alerts but not yet
 * mirrored into the active alerts table). Owns the "show emitted" toggle, the
 * pending list and its ETag-conditional polling.
 *
 * Pending alerts disappear from the backend list when processed (they become
 * active alerts), so every fetch replaces the whole list.
 */
@Injectable({ providedIn: 'root' })
export class PendingAlertsService {
  private readonly departmentIntersectionService = inject(DepartmentIntersectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = inject(LocalStorageService);

  private readonly showPendingSignal = signal<boolean>(
    this.storage.getJson<AlertsVisibility>(STORAGE_KEYS.ALERTS_VISIBILITY)?.pending ?? false,
  );
  private readonly pendingAlertsSignal = signal<ReadonlyArray<PendingAlert>>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly shownDepartmentsSignal = signal<ReadonlyArray<Department>>([]);
  private readonly shownDepartmentsAlertSignal = signal<PendingAlert | null>(null);
  private readonly hoveredDepartmentsSignal = signal<ReadonlyArray<DepartmentRef>>([]);
  private readonly hiddenIdsSignal = signal<ReadonlySet<number>>(new Set());

  readonly showPending = this.showPendingSignal.asReadonly();
  readonly pendingAlerts = this.pendingAlertsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly shownDepartments = this.shownDepartmentsSignal.asReadonly();
  readonly shownDepartmentsAlert = this.shownDepartmentsAlertSignal.asReadonly();
  readonly hoveredDepartments = this.hoveredDepartmentsSignal.asReadonly();
  readonly hiddenIds = this.hiddenIdsSignal.asReadonly();

  private etag: string | undefined = undefined;
  private timerId: number | undefined = undefined;
  /**
   * Guards against stale poll responses dropping a just-emitted alert: bumped
   * on every emission, so a fetch that started before it can be discarded.
   */
  private emissionSeq = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAutoRefresh());

    if (this.showPendingSignal()) {
      void this.fetch();
      this.startAutoRefresh();
    }
  }

  setShowPending(on: boolean): void {
    if (on === this.showPendingSignal()) return;
    this.showPendingSignal.set(on);
    const visibility = this.storage.getJson<AlertsVisibility>(STORAGE_KEYS.ALERTS_VISIBILITY);
    this.storage.setJson<AlertsVisibility>(STORAGE_KEYS.ALERTS_VISIBILITY, {
      active: visibility?.active ?? false,
      pending: on,
    });

    if (on) {
      this.etag = undefined;
      void this.fetch();
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
      this.pendingAlertsSignal.set([]);
      this.etag = undefined;
      this.hiddenIdsSignal.set(new Set());
      this.hideDepartments();
    }
  }

  /**
   * Forces a fresh, authoritative fetch of the pending list (ignoring the
   * cached ETag) and turns the emitted view on. Called right after a background
   * alert generation job completes so the new alert shows up immediately
   * instead of waiting for the next 10 s poll. Bumping `emissionSeq` discards
   * any in-flight poll that started before this refresh.
   */
  async refreshNow(): Promise<void> {
    this.emissionSeq++;
    this.etag = undefined;
    if (!this.showPendingSignal()) {
      this.setShowPending(true); // enables the view, which clears the ETag and fetches
      return;
    }
    await this.fetch();
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

  async showDepartments(alert: PendingAlert): Promise<void> {
    this.shownDepartmentsAlertSignal.set(alert);
    try {
      const response = await firstValueFrom(
        this.departmentIntersectionService.intersectDepartments([...alert.coordinates]),
      );
      // Discard a stale response if the user closed/switched the departments
      // view while this request was in flight.
      if (this.shownDepartmentsAlertSignal()?.alertId !== alert.alertId) return;
      this.shownDepartmentsSignal.set(response.departments);
    } catch (error) {
      console.error('Error al cargar departamentos del aviso pendiente:', error);
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
    if (!this.showPendingSignal()) return;
    await this.fetch();
  }

  private async fetch(): Promise<void> {
    const seqAtStart = this.emissionSeq;
    this.loadingSignal.set(true);
    try {
      const result = await firstValueFrom(
        this.departmentIntersectionService.getPendingAlerts(this.etag),
      );
      if (result.kind === 'not-modified') return;

      if (seqAtStart !== this.emissionSeq) {
        // Stale snapshot taken before the latest emission; keep the optimistic
        // list and let the next poll (with no ETag) bring the fresh one.
        return;
      }

      const baseUrl = environment.alertsService.baseUrl;
      const alerts = result.alerts.map((res) => toPendingAlert(res, baseUrl));
      this.pendingAlertsSignal.set(alerts);
      this.etag = result.etag;

      const shownAlertId = this.shownDepartmentsAlertSignal()?.alertId;
      if (shownAlertId !== undefined && !alerts.some((alert) => alert.alertId === shownAlertId)) {
        this.hideDepartments();
      }
    } catch (error) {
      console.error('Error al obtener avisos pendientes:', error);
    } finally {
      this.loadingSignal.set(false);
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
