import { Injectable, signal, computed } from '@angular/core';
import { Polygon, CreatePolygonDto, UpdatePolygonDto } from '../../models/polygon.model';

/**
 * Servicio para gestionar polígonos en el mapa
 * Proporciona funcionalidades de CRUD y persistencia en localStorage
 */
@Injectable({
  providedIn: 'root',
})
export class PolygonService {
  private readonly STORAGE_KEY = 'mapasmn_polygons';
  private readonly polygons = signal<Polygon[]>([]);

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
      updated[index] = {
        ...updated[index],
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
    const count = this.polygons().length + 1;
    return `Polígono ${count}`;
  }

  /**
   * Obtiene el siguiente color disponible
   */
  private getNextColor(): string {
    const currentCount = this.polygons().length;
    return this.defaultColors[currentCount % this.defaultColors.length];
  }

  /**
   * Guarda los polígonos en localStorage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(this.polygons());
      localStorage.setItem(this.STORAGE_KEY, data);
    } catch (error) {
      console.error('Error al guardar polígonos en localStorage:', error);
    }
  }

  /**
   * Carga los polígonos desde localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
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
}
