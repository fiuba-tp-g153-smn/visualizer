import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface DrawnPolygon {
  id: string;
  name: string;
  coordinates: [number, number][]; // [lat, lng][]
  area?: number;
  createdAt: Date;
  color: string;
}

export type DrawingMode = 'none' | 'polygon' | 'rectangle' | 'circle';

@Injectable({
  providedIn: 'root',
})
export class PolygonService {
  // Estado de dibujo
  private drawingMode = signal<DrawingMode>('none');
  private polygons = signal<DrawnPolygon[]>([]);

  // Eventos para comunicación con el mapa
  private drawingStarted$ = new Subject<DrawingMode>();
  private drawingStopped$ = new Subject<void>();
  private polygonAdded$ = new Subject<DrawnPolygon>();
  private polygonDeleted$ = new Subject<string>();
  private polygonsCleared$ = new Subject<void>();

  // Acceso al estado
  getDrawingMode = this.drawingMode.asReadonly();
  getPolygons = this.polygons.asReadonly();

  // Observables para suscripción
  onDrawingStarted() {
    return this.drawingStarted$.asObservable();
  }

  onDrawingStopped() {
    return this.drawingStopped$.asObservable();
  }

  onPolygonAdded() {
    return this.polygonAdded$.asObservable();
  }

  onPolygonDeleted() {
    return this.polygonDeleted$.asObservable();
  }

  onPolygonsCleared() {
    return this.polygonsCleared$.asObservable();
  }

  // Acciones
  startDrawing(mode: DrawingMode = 'polygon'): void {
    this.drawingMode.set(mode);
    this.drawingStarted$.next(mode);
    console.log(`🎨 Drawing mode started: ${mode}`);
  }

  stopDrawing(): void {
    this.drawingMode.set('none');
    this.drawingStopped$.next();
    console.log('🎨 Drawing mode stopped');
  }

  isDrawing(): boolean {
    return this.drawingMode() !== 'none';
  }

  /**
   * Agrega un polígono completado (llamado desde el mapa)
   */
  addPolygon(polygon: Omit<DrawnPolygon, 'id' | 'createdAt'>): DrawnPolygon {
    const newPolygon: DrawnPolygon = {
      ...polygon,
      id: `polygon-${Date.now()}`,
      createdAt: new Date(),
    };

    this.polygons.update((current) => [...current, newPolygon]);
    this.polygonAdded$.next(newPolygon);
    this.stopDrawing();

    console.log(`✅ Polygon added: ${newPolygon.name}`);
    return newPolygon;
  }

  deletePolygon(polygonId: string): void {
    this.polygons.update((current) => current.filter((p) => p.id !== polygonId));
    this.polygonDeleted$.next(polygonId);
    console.log(`❌ Polygon deleted: ${polygonId}`);
  }

  clearAllPolygons(): void {
    this.polygons.set([]);
    this.polygonsCleared$.next();
    console.log('🗑️ All polygons cleared');
  }

  /**
   * Exporta los polígonos como GeoJSON
   */
  exportToGeoJSON(): any {
    return {
      type: 'FeatureCollection',
      features: this.polygons().map((polygon) => ({
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
          coordinates: [polygon.coordinates.map(([lat, lng]) => [lng, lat])], // GeoJSON usa [lng, lat]
        },
      })),
    };
  }

  /**
   * Descarga los polígonos como archivo GeoJSON
   */
  downloadGeoJSON(): void {
    const geojson = this.exportToGeoJSON();
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `polygons_${new Date().toISOString().split('T')[0]}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
