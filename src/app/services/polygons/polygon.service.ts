import { Injectable, signal, computed, inject } from '@angular/core';
import { Polygon, CreatePolygonDto, UpdatePolygonDto } from '../../models/geo';
import { AlertsService } from './alerts.service';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio para gestionar polígonos en el mapa
 * Proporciona funcionalidades de CRUD y persistencia en localStorage
 */
@Injectable({
  providedIn: 'root',
})
export class PolygonService {
  private readonly POLYGONS_LOCAL_STORAGE_KEY = 'mapasmn_polygons_v3';
  private readonly polygons = signal<Polygon[]>([]);
  private readonly alertsService = inject(AlertsService);

  /**
   * Loading states for polygon operations
   */
  private readonly loadingCut = signal<Set<string>>(new Set());
  private readonly loadingDepartments = signal<Set<string>>(new Set());

  /**
   * Track which department is currently being hovered
   */
  private readonly hoveredDepartmentSignal = signal<{
    polygonId: string;
    departmentName: string;
  } | null>(null);
  readonly hoveredDepartment = this.hoveredDepartmentSignal.asReadonly();

  /**
   * Usar geometrías simplificadas (más rápido, menor detalle)
   */
  readonly useSimplified = signal<boolean>(true);

  /**
   * Lista de polígonos como signal readonly
   */
  readonly allPolygons = this.polygons.asReadonly();

  /**
   * Polígonos visibles
   */
  readonly visiblePolygons = computed(() => {
    return this.polygons().filter((p) => p.visible);
  });

  /**
   * Contador de polígonos totales
   */
  readonly polygonCount = computed(() => {
    return this.polygons().length;
  });

  /**
   * Check if a polygon is being cut
   */
  isPolygonBeingCut(id: string): boolean {
    return this.loadingCut().has(id);
  }

  /**
   * Check if departments are being loaded for a polygon
   */
  isDepartmentsLoading(id: string): boolean {
    return this.loadingDepartments().has(id);
  }

  /**
   * Colores predeterminados para polígonos
   */
  private readonly defaultColors = [
    '#FF5722', // Rojo
    '#2196F3', // Azul
    '#4CAF50', // Verde
    '#FFC107', // Amarillo
    '#9C27B0', // Púrpura
    '#FF9800', // Naranja
    '#00BCD4', // Cian
    '#E91E63', // Rosa
  ];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Obtiene un polígono por su ID
   */
  getPolygonById(id: string): Polygon | undefined {
    return this.polygons().find((p) => p.id === id);
  }

  /**
   * Crea un nuevo polígono
   */
  createPolygon(dto: CreatePolygonDto): Polygon {
    const now = new Date();
    const polygon: Polygon = {
      id: this.generateId(),
      name: dto.name || this.generateDefaultName(),
      coordinates: dto.coordinates,
      color: dto.color || this.getNextColor(),
      visible: true,
      createdAt: now,
      updatedAt: now,
    };

    this.polygons.update((polygons) => [...polygons, polygon]);
    this.saveToStorage();

    return polygon;
  }

  /**
   * Actualiza un polígono existente
   */
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

  /**
   * Elimina un polígono
   */
  deletePolygon(id: string): boolean {
    const initialLength = this.polygons().length;
    this.polygons.update((polygons) => polygons.filter((p) => p.id !== id));

    if (this.polygons().length < initialLength) {
      this.saveToStorage();
      return true;
    }

    return false;
  }

  /**
   * Toggle de visibilidad de un polígono
   */
  toggleVisibility(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    return this.updatePolygon(id, { visible: !polygon.visible });
  }

  /**
   * Elimina todos los polígonos
   */
  deleteAll(): void {
    this.polygons.set([]);
    this.saveToStorage();
  }

  /**
   * Oculta todos los polígonos
   */
  hideAll(): void {
    this.polygons.update((polygons) =>
      polygons.map((p) => ({ ...p, visible: false, updatedAt: new Date() })),
    );
    this.saveToStorage();
  }

  /**
   * Muestra todos los polígonos
   */
  showAll(): void {
    this.polygons.update((polygons) =>
      polygons.map((p) => ({ ...p, visible: true, updatedAt: new Date() })),
    );
    this.saveToStorage();
  }

  /**
   * Genera un ID único
   */
  private generateId(): string {
    return `polygon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Genera un nombre por defecto
   */
  private generateDefaultName(): string {
    return 'Polígono sin nombrar';
  }

  /**
   * Obtiene el siguiente color disponible
   * Busca el primer color no usado, o rota si todos están en uso
   */
  private getNextColor(): string {
    const usedColors = new Set(this.polygons().map((p) => p.color));

    // Buscar el primer color no usado
    for (const color of this.defaultColors) {
      if (!usedColors.has(color)) {
        return color;
      }
    }

    // Si todos están en uso, rotar basado en la cantidad de polígonos
    return this.defaultColors[this.polygons().length % this.defaultColors.length];
  }

  /**
   * Obtiene el siguiente color disponible (método público)
   */
  getNextAvailableColor(): string {
    return this.getNextColor();
  }

  /**
   * Alterna el uso de geometrías simplificadas
   */
  toggleSimplified(): void {
    this.useSimplified.update((val) => !val);
  }

  /**
   * Corta un polígono con los límites de Argentina
   */
  async cutPolygon(id: string): Promise<boolean> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    // Set loading state
    this.loadingCut.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });

    try {
      const cutCoordinates = await firstValueFrom(
        this.alertsService.intersectCountry(polygon.coordinates, this.useSimplified()),
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
      // Clear loading state
      this.loadingCut.update((set) => {
        const newSet = new Set(set);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  /**
   * Restaura el polígono a sus coordenadas originales
   */
  undoCut(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon || !polygon.originalCoordinates) return false;

    return this.updatePolygon(id, {
      coordinates: polygon.originalCoordinates,
      originalCoordinates: undefined,
    });
  }

  /**
   * Carga los departamentos que intersectan con un polígono
   */
  async loadDepartments(id: string): Promise<boolean> {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    // Set loading state
    this.loadingDepartments.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });

    try {
      const response = await firstValueFrom(
        this.alertsService.intersectDepartments(polygon.coordinates, this.useSimplified()),
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
      // Clear loading state
      this.loadingDepartments.update((set) => {
        const newSet = new Set(set);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  /**
   * Alterna la visibilidad de los departamentos de un polígono
   */
  toggleDepartmentsVisibility(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    return this.updatePolygon(id, {
      departmentsVisible: !polygon.departmentsVisible,
    });
  }

  /**
   * Oculta los departamentos de un polígono
   */
  hideDepartments(id: string): boolean {
    const polygon = this.getPolygonById(id);
    if (!polygon) return false;

    return this.updatePolygon(id, {
      departmentsVisible: false,
    });
  }

  /**
   * Guarda los polígonos en localStorage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(this.polygons());
      localStorage.setItem(this.POLYGONS_LOCAL_STORAGE_KEY, data);
    } catch (error) {
      console.error('Error al guardar polígonos en localStorage:', error);
    }
  }

  /**
   * Carga los polígonos desde localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.POLYGONS_LOCAL_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Polygon[];
        // Convertir las fechas de string a Date
        const polygons = parsed.map((p) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));
        this.polygons.set(polygons);
      }
    } catch (error) {
      console.error('Error al cargar polígonos desde localStorage:', error);
      this.polygons.set([]);
    }
  }

  /**
   * Set which department is currently being hovered
   */
  setHoveredDepartment(polygonId: string, departmentName: string): void {
    this.hoveredDepartmentSignal.set({ polygonId, departmentName });
  }

  /**
   * Clear the hovered department
   */
  clearHoveredDepartment(): void {
    this.hoveredDepartmentSignal.set(null);
  }
}
