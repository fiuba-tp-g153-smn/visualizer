import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Polygon, CreatePolygonDto, UpdatePolygonDto, PendingAlert } from '../../models/geo';
import { toPendingAlert } from '../../utils/active-alert.utils';
import {
  AlertsLimitsResponse,
  DepartmentIntersectionService,
} from './department-intersection.service';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DEFAULT_MAX_POLYGON_VERTICES } from '../../config/polygon.config';
import { POLYGON_STATUS, STORAGE_KEYS, buildStaleSubmissionWarning } from '../../constants';
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
    this.flagStaleSubmissions();
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
   * Emits an alert for the polygon. On success the draft is deleted (the alert
   * becomes backend-owned and shows up as a pending alert) and the mapped
   * PendingAlert is returned; on failure the draft is kept and null is returned.
   */
  async generateAlerts(id: string, phenomenonCode: number): Promise<PendingAlert | null> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return null;

    this.loadingAlerts.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });

    console.log('[PolygonService] generateAlerts: marking as submitting', id);
    this.updatePolygon(id, { status: POLYGON_STATUS.SUBMITTING });
    console.log(
      '[PolygonService] generateAlerts: status after update',
      this.getPolygonById(id)?.status,
    );
    console.log(
      '[PolygonService] generateAlerts: storage after update',
      this.storage.getJson(STORAGE_KEYS.POLYGONS),
    );

    try {
      const response = await firstValueFrom(
        this.departmentIntersectionService.generateAlerts(polygon.coordinates, phenomenonCode),
      );

      this.deletePolygon(id);

      return toPendingAlert(response, environment.alertsService.baseUrl);
    } catch (error) {
      console.log('[PolygonService] generateAlerts: error, clearing submitting status', error);
      this.updatePolygon(id, { status: undefined });

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
      return null;
    } finally {
      this.loadingAlerts.update((set) => {
        const newSet = new Set(set);
        newSet.delete(id);
        return newSet;
      });
    }
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
   * Detecta borradores que quedaron marcados como `submitting` de una sesión
   * anterior (la respuesta del POST /alerts se perdió al recargar). Los
   * revierte a borradores normales y avisa al usuario para que verifique
   * manualmente si el aviso llegó a generarse.
   */
  private flagStaleSubmissions(): void {
    console.log(
      '[PolygonService] flagStaleSubmissions: polygons on load',
      this.polygons().map((p) => ({ id: p.id, name: p.name, status: p.status })),
    );
    const staleDrafts = this.polygons().filter((p) => p.status === POLYGON_STATUS.SUBMITTING);
    console.log('[PolygonService] flagStaleSubmissions: stale drafts found', staleDrafts.length);

    for (const draft of staleDrafts) {
      this.updatePolygon(draft.id, { status: undefined });
      this.notifications.error(buildStaleSubmissionWarning(draft.name));
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
