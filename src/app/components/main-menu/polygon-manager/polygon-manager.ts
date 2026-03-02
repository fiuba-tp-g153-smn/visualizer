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
import { PolygonService } from '../../../services/polygons/polygon.service';
import { PolygonDrawingService } from '../../../services/polygons/polygon-drawing.service';
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
    this.drawingService.toggleDrawMode('draw');
  }

  toggleEditMode(): void {
    this.drawingService.toggleDrawMode('edit');
  }

  toggleDeleteMode(): void {
    this.drawingService.toggleDrawMode('delete');
  }

  stopDrawing(): void {
    this.drawingService.stopDrawing();
  }

  saveChanges(): void {
    // The changes are automatically saved by the event handlers
    // Just stop the current mode
    this.drawingService.stopDrawing();
  }

  isDrawing(): boolean {
    return this.drawingMode() === 'draw';
  }

  isEditing(): boolean {
    return this.drawingMode() === 'edit';
  }

  isDeleting(): boolean {
    return this.drawingMode() === 'delete';
  }

  toggleVisibility(id: string): void {
    this.polygonService.toggleVisibility(id);
  }

  deletePolygon(id: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar este polígono?')) {
      this.polygonService.deletePolygon(id);
    }
  }

  deleteAll(): void {
    if (confirm('¿Estás seguro de que deseas eliminar TODOS los polígonos?')) {
      this.polygonService.deleteAll();
    }
  }

  hideAll(): void {
    this.polygonService.hideAll();
  }

  showAll(): void {
    this.polygonService.showAll();
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
}
