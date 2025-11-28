import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

export interface DrawnPolygon {
  id: string;
  name: string;
  coordinates: [number, number][];
  area?: number;
  createdAt: Date;
  color: string;
}

@Component({
  selector: 'app-polygon-tool',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatListModule,
    MatDividerModule,
    MatChipsModule,
  ],
  templateUrl: './polygon-tool.html',
  styleUrl: './polygon-tool.scss',
})
export class PolygonTool {
  isDrawing = signal(false);
  polygons = signal<DrawnPolygon[]>([]);

  startDrawing(): void {
    this.isDrawing.set(true);
    // TODO: Integrar con Leaflet Draw o L.Draw
    console.log('Starting polygon drawing mode');

    // Mock: Simular la creación de un polígono
    setTimeout(() => {
      this.addMockPolygon();
      this.isDrawing.set(false);
    }, 2000);
  }

  stopDrawing(): void {
    this.isDrawing.set(false);
    console.log('Stopping polygon drawing mode');
  }

  deletePolygon(polygonId: string): void {
    this.polygons.update((polygons) => polygons.filter((p) => p.id !== polygonId));
    console.log(`Deleting polygon: ${polygonId}`);
  }

  clearAllPolygons(): void {
    if (confirm('¿Estás seguro de que deseas eliminar todos los polígonos?')) {
      this.polygons.set([]);
      console.log('All polygons cleared');
    }
  }

  exportPolygons(): void {
    const geojson = this.convertToGeoJSON();
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `polygons_${new Date().toISOString()}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private convertToGeoJSON(): any {
    return {
      type: 'FeatureCollection',
      features: this.polygons().map((polygon) => ({
        type: 'Feature',
        properties: {
          id: polygon.id,
          name: polygon.name,
          area: polygon.area,
          createdAt: polygon.createdAt,
          color: polygon.color,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [polygon.coordinates],
        },
      })),
    };
  }

  private addMockPolygon(): void {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const mockPolygon: DrawnPolygon = {
      id: `poly_${Date.now()}`,
      name: `Polígono ${this.polygons().length + 1}`,
      coordinates: [
        [-58.4, -34.6],
        [-58.3, -34.6],
        [-58.3, -34.5],
        [-58.4, -34.5],
        [-58.4, -34.6],
      ],
      area: 123.45,
      createdAt: new Date(),
      color: randomColor,
    };

    this.polygons.update((polygons) => [...polygons, mockPolygon]);
  }

  formatArea(area?: number): string {
    if (!area) return 'N/A';
    if (area > 1000) {
      return `${(area / 1000).toFixed(2)} km²`;
    }
    return `${area.toFixed(2)} m²`;
  }
}
