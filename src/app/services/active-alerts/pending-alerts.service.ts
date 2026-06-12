import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DepartmentIntersectionService } from '../polygons/department-intersection.service';
import { AlertsVisibility, Department, PendingAlert } from '../../models/geo';
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
  private readonly hoveredDepartmentsSignal = signal<ReadonlyArray<string>>([]);
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
   * Registers an alert just emitted via POST /alerts: it is inserted into the
   * pending list immediately (the POST response carries the full pending shape)
   * and the emitted view is turned on so the user sees it right away.
   */
  addEmitted(alert: PendingAlert): void {
    this.emissionSeq++;
    this.pendingAlertsSignal.update((alerts) => {
      const others = alerts.filter((a) => a.alertId !== alert.alertId);
      return [...others, alert].sort((a, b) => a.alertId - b.alertId);
    });
    // The cached ETag predates this emission; drop it so the next poll
    // re-fetches the authoritative list.
    this.etag = undefined;
    this.setShowPending(true);
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
      this.shownDepartmentsSignal.set(response.departments);
    } catch (error) {
      console.error('Error al cargar departamentos del aviso pendiente:', error);
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
      this.pendingAlertsSignal.set(result.alerts.map((res) => toPendingAlert(res, baseUrl)));
      this.etag = result.etag;
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
