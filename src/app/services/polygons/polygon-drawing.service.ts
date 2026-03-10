import { Injectable, signal } from '@angular/core';

/**
 * Modos de dibujo disponibles para polígonos
 */
export enum DrawingMode {
  NONE = 'none',
  DRAW = 'draw',
  EDIT = 'edit',
  DELETE = 'delete',
}

/**
 * Servicio para controlar el modo de dibujo de polígonos
 */
@Injectable({
  providedIn: 'root',
})
export class PolygonDrawingService {
  /**
   * Modo de dibujo actual
   */
  readonly drawingMode = signal<DrawingMode>(DrawingMode.NONE);

  /**
   * ID del polígono siendo editado (si hay uno)
   */
  readonly editingPolygonId = signal<string | null>(null);

  /**
   * Inicia el modo de dibujo
   */
  startDrawing(): void {
    this.editingPolygonId.set(null);
    this.drawingMode.set(DrawingMode.DRAW);
  }

  /**
   * Inicia el modo de edición para un polígono específico
   */
  startEditMode(polygonId: string): void {
    this.editingPolygonId.set(polygonId);
    this.drawingMode.set(DrawingMode.EDIT);
  }

  /**
   * Inicia el modo de edición global
   */
  startEditing(): void {
    this.editingPolygonId.set(null);
    this.drawingMode.set(DrawingMode.EDIT);
  }

  /**
   * Inicia el modo de borrado
   */
  startDeleting(): void {
    this.editingPolygonId.set(null);
    this.drawingMode.set(DrawingMode.DELETE);
  }

  /**
   * Detiene cualquier modo activo
   */
  stopDrawing(): void {
    this.editingPolygonId.set(null);
    this.drawingMode.set(DrawingMode.NONE);
  }

  /**
   * Toggle del modo de dibujo
   */
  toggleDrawMode(mode: DrawingMode): void {
    if (this.drawingMode() === mode) {
      this.stopDrawing();
    } else {
      this.editingPolygonId.set(null);
      this.drawingMode.set(mode);
    }
  }
}
