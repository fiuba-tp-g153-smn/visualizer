import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { PolygonService } from '../../../services/polygons/polygon.service';
import {
  DrawingMode,
  PolygonDrawingService,
} from '../../../services/polygons/polygon-drawing.service';
import { Polygon } from '../../../models/polygon.model';
import { MenuPanelComponent } from '../menu-section.model';

/**
 * Panel para gestionar polígonos en el mapa
 * Permite crear, editar, eliminar y controlar la visibilidad de polígonos
 */
@Component({
  selector: 'app-polygon-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatMenuModule,
  ],
  templateUrl: './polygon-manager.html',
  styleUrl: './polygon-manager.scss',
})
export class PolygonManagerComponent implements MenuPanelComponent, OnDestroy {
  private readonly polygonService = inject(PolygonService);
  private readonly drawingService = inject(PolygonDrawingService);

  readonly polygons = this.polygonService.allPolygons;
  readonly polygonCount = this.polygonService.polygonCount;
  readonly drawingMode = this.drawingService.drawingMode;
  readonly useSimplified = this.polygonService.useSimplified;

  editingNameId: string | null = null;
  editingColorId: string | null = null;

  onPanelOpen(): void {
    // Hook cuando el panel se abre
  }

  ngOnDestroy(): void {
    // Stop any active drawing mode when panel is closed
    this.drawingService.stopDrawing();
  }

  // Drawing controls
  toggleDrawMode(): void {
    this.drawingService.toggleDrawMode(DrawingMode.DRAW);
  }

  stopDrawing(): void {
    this.drawingService.stopDrawing();
  }

  isDrawing(): boolean {
    return this.drawingMode() === DrawingMode.DRAW;
  }

  editPolygon(id: string): void {
    // Set the polygon to edit mode
    this.drawingService.startEditMode(id);
  }

  toggleVisibility(id: string): void {
    this.polygonService.toggleVisibility(id);
  }

  deletePolygon(id: string): void {
    this.polygonService.deletePolygon(id);
  }

  deleteAll(): void {
    // Delete without confirmation for now (can add modal later)
    this.polygonService.deleteAll();
  }

  startEditingName(id: string): void {
    this.editingNameId = id;
  }

  finishEditingName(polygon: Polygon, newName: string): void {
    if (newName.trim()) {
      this.polygonService.updatePolygon(polygon.id, { name: newName.trim() });
    }
    this.editingNameId = null;
  }

  cancelEditingName(): void {
    this.editingNameId = null;
  }

  updateColor(id: string, color: string): void {
    this.polygonService.updatePolygon(id, { color });
  }

  toggleSimplified(): void {
    this.polygonService.toggleSimplified();
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getCoordinatesCount(polygon: Polygon): number {
    return polygon.coordinates.length;
  }

  getDepartmentsCount(polygon: Polygon): number {
    return polygon.departments?.length || 0;
  }

  getDepartmentsList(polygon: Polygon): string {
    if (!polygon.departments || polygon.departments.length === 0) {
      return 'Sin datos';
    }
    return polygon.departments
      .map((dept) => (dept.properties && dept.properties['nam']) || 'Desconocido')
      .join(', ');
  }

  hasDepartments(polygon: Polygon): boolean {
    return !!(polygon.departments && polygon.departments.length > 0);
  }

  isLoadingCut(polygon: Polygon): boolean {
    return this.polygonService.isPolygonBeingCut(polygon.id);
  }

  isLoadingDepartments(polygon: Polygon): boolean {
    return this.polygonService.isDepartmentsLoading(polygon.id);
  }

  async loadDepartments(polygonId: string): Promise<void> {
    await this.polygonService.loadDepartments(polygonId);
  }

  async cutPolygon(polygonId: string): Promise<void> {
    await this.polygonService.cutPolygon(polygonId);
  }

  undoCut(polygonId: string): void {
    this.polygonService.undoCut(polygonId);
  }

  canUndoCut(polygon: Polygon): boolean {
    return !!(polygon.originalCoordinates && polygon.originalCoordinates.length > 0);
  }
}
