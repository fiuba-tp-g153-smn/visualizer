import { Injectable, signal } from '@angular/core';

export type DrawingMode = 'none' | 'draw' | 'edit' | 'delete';

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
  readonly drawingMode = signal<DrawingMode>('none');

  /**
   * Inicia el modo de dibujo
   */
  startDrawing(): void {
    this.drawingMode.set('draw');
  }

  /**
   * Inicia el modo de edición
   */
  startEditing(): void {
    this.drawingMode.set('edit');
  }

  /**
   * Inicia el modo de borrado
   */
  startDeleting(): void {
    this.drawingMode.set('delete');
  }

  /**
   * Detiene cualquier modo activo
   */
  stopDrawing(): void {
    this.drawingMode.set('none');
  }

  /**
   * Toggle del modo de dibujo
   */
  toggleDrawMode(mode: DrawingMode): void {
    if (this.drawingMode() === mode) {
      this.stopDrawing();
    } else {
      this.drawingMode.set(mode);
    }
  }
}
