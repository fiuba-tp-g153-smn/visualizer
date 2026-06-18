import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Polygon, CreatePolygonDto, UpdatePolygonDto } from '../../models/geo';
import {
  AlertJobAccepted,
  AlertsLimitsResponse,
  DepartmentIntersectionService,
} from './department-intersection.service';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_MAX_POLYGON_VERTICES } from '../../config/polygon.config';
import { POLYGON_STATUS, STORAGE_KEYS } from '../../constants';
import { LocalStorageService } from '../storage/local-storage.service';
import { NotificationService } from '../notifications/notification.service';

const HTTP_STATUS_PAYLOAD_TOO_LARGE = 413;

@Injectable({
  providedIn: 'root',
})
export class PolygonService {
  private readonly polygons = signal<Polygon[]>([]);
  private readonly departmentIntersectionService = inject(DepartmentIntersectionService);
  private readonly storage = inject(LocalStorageService);
  private readonly notifications = inject(NotificationService);

  private readonly loadingCut = signal<Set<string>>(new Set());
  private readonly loadingDepartments = signal<Set<string>>(new Set());
  private readonly loadingAlerts = signal<Set<string>>(new Set());

  private readonly hoveredDepartmentsSignal = signal<{
    polygonId: string;
    departmentNames: ReadonlyArray<string>;
  } | null>(null);
  readonly hoveredDepartments = this.hoveredDepartmentsSignal.asReadonly();

  readonly detailLevel = signal<number>(5);

  private readonly maxVerticesSignal = signal<number>(DEFAULT_MAX_POLYGON_VERTICES);
  readonly maxVertices = this.maxVerticesSignal.asReadonly();

  readonly allPolygons = this.polygons.asReadonly();

  readonly visiblePolygons = computed(() => {
    return this.polygons().filter((p) => p.visible);
  });

  readonly polygonCount = computed(() => {
    return this.polygons().length;
  });

  isPolygonBeingCut(id: string): boolean {
    return this.loadingCut().has(id);
  }

  isDepartmentsLoading(id: string): boolean {
    return this.loadingDepartments().has(id);
  }

  isAlertsLoading(id: string): boolean {
    return this.loadingAlerts().has(id);
  }

  constructor() {
    this.loadFromStorage();
    this.loadDetailLevelFromStorage();
    this.loadMaxVertices();
    this.restoreSubmittingState();
  }

  private loadMaxVertices(): void {
    this.departmentIntersectionService.getMaxPolygonVertices().subscribe((max) => {
      this.maxVerticesSignal.set(max);
    });
  }

  exceedsMaxVertices(polygon: Polygon): boolean {
    return polygon.coordinates.length > this.maxVerticesSignal();
  }

  getPolygonById(id: string): Polygon | undefined {
    return this.polygons().find((p) => p.id === id);
  }

  createPolygon(dto: CreatePolygonDto): Polygon {
    const now = new Date();
    const polygon: Polygon = {
      id: this.generateId(),
      name: dto.name,
      draftNumber: this.takeNextDraftNumber(),
      coordinates: dto.coordinates,
      visible: true,
      createdAt: now,
      updatedAt: now,
    };

    this.polygons.update((polygons) => [...polygons, polygon]);
    this.saveToStorage();

    return polygon;
  }

  updatePolygon(id: string, dto: UpdatePolygonDto): boolean {
    const index = this.polygons().findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.polygons.update((polygons) => {
      const updated = [...polygons];
      const current = updated[index];

      // If coordinates are changing and departments/originalCoordinates are not explicitly provided,
      // clear them to indicate geometry has changed
      let clearData = {};
      if (
        dto.coordinates &&
        dto.departments === undefined &&
        dto.originalCoordinates === undefined
      ) {
        clearData = {
          departments: undefined,
          departmentsVisible: false,
          originalCoordinates: undefined,
        };
      }

      updated[index] = {
        ...current,
        ...clearData,
        ...dto,
        updatedAt: new Date(),
      };
      return updated;
    });

    this.saveToStorage();
    return true;
  }

  deletePolygon(id: string): boolean {
    const initialLength = this.polygons().length;
    this.polygons.update((polygons) => polygons.filter((p) => p.id !== id));

    if (this.polygons().length < initialLength) {
      this.saveToStorage();
      return true;
    }

    return false;
  }

  toggleVisibility(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    return this.updatePolygon(id, { visible: !polygon.visible });
  }

  deleteAll(): void {
    this.polygons.set([]);
    this.saveToStorage();
  }

  hideAll(): void {
    this.polygons.update((polygons) =>
      polygons.map((p) => ({ ...p, visible: false, updatedAt: new Date() })),
    );
    this.saveToStorage();
  }

  showAll(): void {
    this.polygons.update((polygons) =>
      polygons.map((p) => ({ ...p, visible: true, updatedAt: new Date() })),
    );
    this.saveToStorage();
  }

  private generateId(): string {
    return `polygon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private takeNextDraftNumber(): number {
    const stored = this.storage.getString(STORAGE_KEYS.POLYGON_NEXT_DRAFT_NUMBER);
    const next = stored !== null ? parseInt(stored, 10) : 1;
    const current = isNaN(next) ? 1 : next;
    this.storage.setString(STORAGE_KEYS.POLYGON_NEXT_DRAFT_NUMBER, (current + 1).toString());
    return current;
  }

  setDetailLevel(level: number): void {
    // Asegurarse de que el valor esté entre 1 y 5
    const clampedLevel = Math.max(1, Math.min(5, Math.round(level)));
    this.detailLevel.set(clampedLevel);
    this.saveDetailLevelToStorage(clampedLevel);
  }

  async cutPolygon(id: string): Promise<boolean> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    this.loadingCut.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });

    try {
      const cutCoordinates = await firstValueFrom(
        this.departmentIntersectionService.intersectCountry(
          polygon.coordinates,
          this.detailLevel(),
        ),
      );

      if (cutCoordinates.length === 0) {
        console.error('[PolygonService] El resultado del corte está vacío');
        throw new Error('El resultado del corte está vacío');
      }

      // Guardar las coordenadas originales si no existen
      const originalCoordinates = polygon.originalCoordinates || polygon.coordinates;

      this.updatePolygon(id, {
        coordinates: cutCoordinates,
        originalCoordinates: originalCoordinates,
      });

      return true;
    } catch (error) {
      console.error('[PolygonService] Error al recortar polígono:', error);
      return false;
    } finally {
      this.loadingCut.update((set) => {
        const newSet = new Set(set);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  undoCut(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon || !polygon.originalCoordinates) return false;

    return this.updatePolygon(id, {
      coordinates: polygon.originalCoordinates,
      originalCoordinates: undefined,
    });
  }

  async loadDepartments(id: string): Promise<boolean> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    this.loadingDepartments.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });

    try {
      const response = await firstValueFrom(
        this.departmentIntersectionService.intersectDepartments(polygon.coordinates),
      );

      this.updatePolygon(id, {
        departments: response.departments,
        departmentsVisible: true,
      });

      return true;
    } catch (error) {
      console.error('Error al cargar departamentos:', error);
      return false;
    } finally {
      this.loadingDepartments.update((set) => {
        const newSet = new Set(set);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  /**
   * Queues background generation of an alert for the polygon. Returns the
   * accepted job (the draft stays marked as submitting while it generates) or
   * null on a synchronous failure (invalid/oversized polygon), in which case
   * the draft is reverted and the user is notified.
   *
   * The caller must drive the job to completion and then call `finishEmission`
   * (on success) or `cancelEmission` (on failure/timeout).
   */
  async generateAlerts(id: string, phenomenonCode: number): Promise<AlertJobAccepted | null> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return null;

    this.setAlertsLoading(id, true);
    this.updatePolygon(id, { status: POLYGON_STATUS.SUBMITTING });

    try {
      // The draft and loading state are kept; the job runs in the background.
      const accepted = await firstValueFrom(
        this.departmentIntersectionService.generateAlerts(polygon.coordinates, phenomenonCode),
      );
      // Persisted so the job can be resumed (polled to completion) if the page
      // reloads while it's still running.
      this.updatePolygon(id, { jobId: accepted.job_id });
      return accepted;
    } catch (error) {
      this.cancelEmission(id);

      if (error instanceof HttpErrorResponse && error.status === HTTP_STATUS_PAYLOAD_TOO_LARGE) {
        const maxVertexCount = (error.error as AlertsLimitsResponse | null)?.max_vertex_count;
        if (maxVertexCount) {
          this.maxVerticesSignal.set(maxVertexCount);
        }
        this.notifications.error(
          `El polígono supera el máximo de ${this.maxVerticesSignal()} vértices permitidos. Simplificá el polígono para poder generar el aviso.`,
        );
        return null;
      }

      console.error('Error al generar alertas:', error);
      this.notifications.error('No se pudo generar el aviso. Intentá de nuevo.');
      return null;
    }
  }

  /**
   * Completes a successful emission: the alert is now backend-owned (it shows
   * up as a pending alert), so the draft is deleted and loading is cleared.
   */
  finishEmission(id: string): void {
    this.setAlertsLoading(id, false);
    this.deletePolygon(id);
  }

  /**
   * Aborts an in-progress emission, keeping the draft so the user can retry:
   * reverts the submitting status and clears the loading state.
   */
  cancelEmission(id: string): void {
    this.updatePolygon(id, { status: undefined, jobId: undefined });
    this.setAlertsLoading(id, false);
  }

  /**
   * Drafts whose background job survived a page reload (`status: 'submitting'`
   * with a persisted `jobId`), so the caller can resume polling them to
   * completion instead of re-submitting (which would duplicate the alert).
   */
  getResumableJobs(): ReadonlyArray<{ id: string; jobId: string }> {
    return this.polygons()
      .filter((p) => p.status === POLYGON_STATUS.SUBMITTING && p.jobId !== undefined)
      .map((p) => ({ id: p.id, jobId: p.jobId as string }));
  }

  private setAlertsLoading(id: string, loading: boolean): void {
    this.loadingAlerts.update((set) => {
      const newSet = new Set(set);
      if (loading) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }

  toggleDepartmentsVisibility(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    return this.updatePolygon(id, {
      departmentsVisible: !polygon.departmentsVisible,
    });
  }

  hideDepartments(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    return this.updatePolygon(id, {
      departmentsVisible: false,
    });
  }

  private saveToStorage(): void {
    this.storage.setJson(STORAGE_KEYS.POLYGONS, this.polygons());
  }

  private loadFromStorage(): void {
    const parsed = this.storage.getJson<Array<Polygon & { alerts?: unknown }>>(
      STORAGE_KEYS.POLYGONS,
    );
    if (!parsed) return;
    this.polygons.set(
      parsed
        // Legacy entries kept after emission are backend-owned now (they live in
        // the pending/active alert lists); drop them to avoid duplication.
        .filter((p) => p.alerts === undefined)
        .map((p) => ({
          ...p,
          draftNumber: p.draftNumber ?? this.takeNextDraftNumber(),
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        })),
    );
  }

  /**
   * Restores `submitting` drafts on load. Those with a `jobId` are kept
   * blocked (loading) so `AlertEmissionService` can resume polling them;
   * orphans (no `jobId`, the POST response was lost before this session's
   * code persisted it) are silently reverted to normal, editable drafts.
   */
  private restoreSubmittingState(): void {
    for (const polygon of this.polygons()) {
      if (polygon.status !== POLYGON_STATUS.SUBMITTING) continue;

      if (polygon.jobId !== undefined) {
        this.setAlertsLoading(polygon.id, true);
      } else {
        this.updatePolygon(polygon.id, { status: undefined });
      }
    }
  }

  private saveDetailLevelToStorage(level: number): void {
    this.storage.setString(STORAGE_KEYS.POLYGON_DETAIL_LEVEL, level.toString());
  }

  private loadDetailLevelFromStorage(): void {
    const data = this.storage.getString(STORAGE_KEYS.POLYGON_DETAIL_LEVEL);
    if (data === null) return;
    const level = parseInt(data, 10);
    if (!isNaN(level)) {
      this.detailLevel.set(Math.max(1, Math.min(5, level)));
    }
  }

  setHoveredDepartment(polygonId: string, departmentName: string): void {
    this.hoveredDepartmentsSignal.set({ polygonId, departmentNames: [departmentName] });
  }

  /** Highlights several departments at once (e.g. hovering a whole province). */
  setHoveredDepartments(polygonId: string, departmentNames: ReadonlyArray<string>): void {
    this.hoveredDepartmentsSignal.set({ polygonId, departmentNames });
  }

  clearHoveredDepartment(): void {
    this.hoveredDepartmentsSignal.set(null);
  }
}
