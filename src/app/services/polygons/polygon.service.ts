import { Injectable, signal, computed, inject } from '@angular/core';
import { Polygon, CreatePolygonDto, UpdatePolygonDto } from '../../models/geo';
import { AlertsService } from './alerts.service';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DEPARTMENTS_SIMPLIFICATION_LEVEL } from '../../config/polygon.config';
import { STORAGE_KEYS } from '../../constants';
import { LocalStorageService } from '../storage/local-storage.service';

@Injectable({
  providedIn: 'root',
})
export class PolygonService {
  private readonly polygons = signal<Polygon[]>([]);
  private readonly alertsService = inject(AlertsService);
  private readonly storage = inject(LocalStorageService);

  private readonly loadingCut = signal<Set<string>>(new Set());
  private readonly loadingDepartments = signal<Set<string>>(new Set());
  private readonly loadingAlerts = signal<Set<string>>(new Set());

  private readonly hoveredDepartmentSignal = signal<{
    polygonId: string;
    departmentName: string;
  } | null>(null);
  readonly hoveredDepartment = this.hoveredDepartmentSignal.asReadonly();

  readonly simplificationLevel = signal<number>(5);

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

  hasAlerts(id: string): boolean {
    const polygon = this.getPolygonById(id);
    return !!(polygon?.alerts?.gifAreaUrl || polygon?.alerts?.gifGralUrl);
  }

  constructor() {
    this.loadFromStorage();
    this.loadSimplificationLevelFromStorage();
  }

  getPolygonById(id: string): Polygon | undefined {
    return this.polygons().find((p) => p.id === id);
  }

  createPolygon(dto: CreatePolygonDto): Polygon {
    const now = new Date();
    const polygon: Polygon = {
      id: this.generateId(),
      name: dto.name || this.generateDefaultName(),
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

  private generateDefaultName(): string {
    return 'Polígono sin nombrar';
  }

  setSimplificationLevel(level: number): void {
    // Asegurarse de que el valor esté entre 0 y 10
    const clampedLevel = Math.max(0, Math.min(10, Math.round(level)));
    this.simplificationLevel.set(clampedLevel);
    this.saveSimplificationLevelToStorage(clampedLevel);
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
        this.alertsService.intersectCountry(polygon.coordinates, this.simplificationLevel()),
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
        this.alertsService.intersectDepartments(
          polygon.coordinates,
          DEPARTMENTS_SIMPLIFICATION_LEVEL,
        ),
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

  async generateAlerts(id: string, phenomenonCode: number): Promise<boolean> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    this.loadingAlerts.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });

    try {
      const response = await firstValueFrom(
        this.alertsService.generateAlerts(polygon.coordinates, phenomenonCode),
      );

      const baseUrl = environment.alertsService.baseUrl;

      this.updatePolygon(id, {
        alerts: {
          alertId: response.alert_id,
          timestamp: response.timestamp,
          phenomenonCode: response.phenomenon_code,
          phenomenon: response.phenomenon,
          gifAreaUrl: `${baseUrl}${response.gif_area_url}`,
          gifGralUrl: `${baseUrl}${response.gif_gral_url}`,
          affectedDepartmentsCount: response.affected_departments_count,
          generatedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error al generar alertas:', error);
      return false;
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
    const parsed = this.storage.getJson<Polygon[]>(STORAGE_KEYS.POLYGONS);
    if (!parsed) return;
    this.polygons.set(
      parsed.map((p) => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })),
    );
  }

  private saveSimplificationLevelToStorage(level: number): void {
    this.storage.setString(STORAGE_KEYS.POLYGON_SIMPLIFICATION_LEVEL, level.toString());
  }

  private loadSimplificationLevelFromStorage(): void {
    const data = this.storage.getString(STORAGE_KEYS.POLYGON_SIMPLIFICATION_LEVEL);
    if (data === null) return;
    const level = parseInt(data, 10);
    if (!isNaN(level)) {
      this.simplificationLevel.set(Math.max(0, Math.min(10, level)));
    }
  }

  setHoveredDepartment(polygonId: string, departmentName: string): void {
    this.hoveredDepartmentSignal.set({ polygonId, departmentName });
  }

  clearHoveredDepartment(): void {
    this.hoveredDepartmentSignal.set(null);
  }
}
