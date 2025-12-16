import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface DrawnPolygon {
  id: string;
  name: string;
  coordinates: [number, number][]; // [lat, lng][]
  area?: number;
  createdAt: Date;
  color: string;
  visible: boolean;
  opacity: number; // 0-100
}

@Injectable({
  providedIn: 'root',
})
export class PolygonService {
  // Estado
  private _isDrawing = signal<boolean>(false);
  private _editingPolygonId = signal<string | null>(null);
  private _polygons = signal<DrawnPolygon[]>([]);

  // Eventos para comunicación con el mapa
  private drawingStarted$ = new Subject<void>();
  private drawingStopped$ = new Subject<void>();
  private editingStarted$ = new Subject<string>();
  private editingStopped$ = new Subject<void>();
  private polygonUpdated$ = new Subject<DrawnPolygon>();
  private polygonDeleted$ = new Subject<string>();
  private polygonsCleared$ = new Subject<void>();
  private zoomToPolygon$ = new Subject<string>();

  // Acceso al estado
  isDrawing = this._isDrawing.asReadonly();
  editingPolygonId = this._editingPolygonId.asReadonly();
  polygons = this._polygons.asReadonly();

  // Observables
  onDrawingStarted() {
    return this.drawingStarted$.asObservable();
  }

  onDrawingStopped() {
    return this.drawingStopped$.asObservable();
  }

  onEditingStarted() {
    return this.editingStarted$.asObservable();
  }

  onEditingStopped() {
    return this.editingStopped$.asObservable();
  }

  onPolygonUpdated() {
    return this.polygonUpdated$.asObservable();
  }

  onPolygonDeleted() {
    return this.polygonDeleted$.asObservable();
  }

  onPolygonsCleared() {
    return this.polygonsCleared$.asObservable();
  }

  onZoomToPolygon() {
    return this.zoomToPolygon$.asObservable();
  }

  // Acciones
  startDrawing(): void {
    this._isDrawing.set(true);
    this.drawingStarted$.next();
    console.log('🎨 Drawing started');
  }

  stopDrawing(): void {
    this._isDrawing.set(false);
    this.drawingStopped$.next();
    console.log('🎨 Drawing stopped');
  }

  addPolygon(
    polygon: Omit<DrawnPolygon, 'id' | 'createdAt' | 'visible' | 'opacity'>
  ): DrawnPolygon {
    const newPolygon: DrawnPolygon = {
      ...polygon,
      id: `polygon-${Date.now()}`,
      createdAt: new Date(),
      visible: true,
      opacity: 70,
    };

    this._polygons.update((current) => [...current, newPolygon]);
    this.stopDrawing();
    console.log('✅ Polygon added:', newPolygon.name);
    return newPolygon;
  }

  renamePolygon(polygonId: string, newName: string): void {
    this._polygons.update((current) =>
      current.map((p) => (p.id === polygonId ? { ...p, name: newName } : p))
    );
    // Notificar al mapa para actualizar el popup
    const updated = this._polygons().find((p) => p.id === polygonId);
    if (updated) {
      this.polygonUpdated$.next(updated);
    }
  }

  changeColor(polygonId: string, newColor: string): void {
    this._polygons.update((current) =>
      current.map((p) => (p.id === polygonId ? { ...p, color: newColor } : p))
    );
    // Notificar al mapa para actualizar el estilo
    const updated = this._polygons().find((p) => p.id === polygonId);
    if (updated) {
      this.polygonUpdated$.next(updated);
    }
  }

  toggleVisibility(polygonId: string): void {
    this._polygons.update((current) =>
      current.map((p) => (p.id === polygonId ? { ...p, visible: !p.visible } : p))
    );
    const updated = this._polygons().find((p) => p.id === polygonId);
    if (updated) {
      this.polygonUpdated$.next(updated);
    }
  }

  changeOpacity(polygonId: string, opacity: number): void {
    this._polygons.update((current) =>
      current.map((p) => (p.id === polygonId ? { ...p, opacity } : p))
    );
    const updated = this._polygons().find((p) => p.id === polygonId);
    if (updated) {
      this.polygonUpdated$.next(updated);
    }
  }

  // Edición de vértices
  startEditing(polygonId: string): void {
    this._editingPolygonId.set(polygonId);
    this.editingStarted$.next(polygonId);
    console.log('✏️ Editing started:', polygonId);
  }

  stopEditing(): void {
    this._editingPolygonId.set(null);
    this.editingStopped$.next();
    console.log('✏️ Editing stopped');
  }

  isEditing(polygonId?: string): boolean {
    if (polygonId) {
      return this._editingPolygonId() === polygonId;
    }
    return this._editingPolygonId() !== null;
  }

  updatePolygon(polygonId: string, coordinates: [number, number][], area: number): void {
    this._polygons.update((current) =>
      current.map((p) => (p.id === polygonId ? { ...p, coordinates, area } : p))
    );
    const updated = this._polygons().find((p) => p.id === polygonId);
    if (updated) {
      this.polygonUpdated$.next(updated);
    }
  }

  deletePolygon(polygonId: string): void {
    this._polygons.update((current) => current.filter((p) => p.id !== polygonId));
    this.polygonDeleted$.next(polygonId);
    console.log('❌ Polygon deleted:', polygonId);
  }

  clearAllPolygons(): void {
    this._polygons.set([]);
    this.polygonsCleared$.next();
    console.log('🗑️ All polygons cleared');
  }

  zoomTo(polygonId: string): void {
    this.zoomToPolygon$.next(polygonId);
  }

  movePolygon(polygonId: string, direction: 'up' | 'down'): void {
    this._polygons.update((current) => {
      const index = current.findIndex((p) => p.id === polygonId);
      if (index === -1) return current;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= current.length) return current;

      const newArray = [...current];
      [newArray[index], newArray[newIndex]] = [newArray[newIndex], newArray[index]];
      return newArray;
    });
  }

  exportToGeoJSON(): any {
    return {
      type: 'FeatureCollection',
      features: this._polygons().map((polygon) => ({
        type: 'Feature',
        properties: {
          id: polygon.id,
          name: polygon.name,
          area: polygon.area,
          createdAt: polygon.createdAt.toISOString(),
          color: polygon.color,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [polygon.coordinates.map(([lat, lng]) => [lng, lat])],
        },
      })),
    };
  }

  downloadGeoJSON(): void {
    const geojson = this.exportToGeoJSON();
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `polygons_${new Date().toISOString().split('T')[0]}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
