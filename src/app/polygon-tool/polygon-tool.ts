import { Component, inject, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { PolygonService, DrawnPolygon } from '../services/polygon.service';

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
  private polygonService = inject(PolygonService);

  // Estado reactivo desde el servicio
  isDrawing = computed(() => this.polygonService.isDrawing());
  polygons = this.polygonService.getPolygons;

  startDrawing(): void {
    this.polygonService.startDrawing('polygon');
  }

  stopDrawing(): void {
    this.polygonService.stopDrawing();
  }

  deletePolygon(polygonId: string): void {
    this.polygonService.deletePolygon(polygonId);
  }

  clearAllPolygons(): void {
    if (confirm('¿Estás seguro de que deseas eliminar todos los polígonos?')) {
      this.polygonService.clearAllPolygons();
    }
  }

  exportPolygons(): void {
    this.polygonService.downloadGeoJSON();
  }

  formatArea(area?: number): string {
    if (!area) return 'N/A';
    if (area > 1000000) {
      return `${(area / 1000000).toFixed(2)} km²`;
    }
    return `${area.toFixed(2)} m²`;
  }
}
