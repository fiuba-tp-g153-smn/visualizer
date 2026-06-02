import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PolygonService } from '../../../../services/polygons/polygon.service';
import {
  DrawingMode,
  PolygonDrawingService,
} from '../../../../services/polygons/polygon-drawing.service';
import { Polygon } from '../../../../models/geo';
import { MenuPanelComponent } from '../menu-section.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../floating/confirm-dialog/confirm-dialog';
import { PhenomenonSelectionDialogComponent } from '../../../floating/phenomenon-selection-dialog/phenomenon-selection-dialog';
import { formatDateTimeLocalized } from '../../../../utils/tileset-timestamp';
import { ActiveAlertsComponent } from './active-alerts/active-alerts';

/**
 * Panel para gestionar polígonos en el mapa
 * Permite crear, editar, eliminar y controlar la visibilidad de polígonos
 */
@Component({
  selector: 'app-polygon-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatDividerModule,
    MatSliderModule,
    MatMenuModule,
    MatTabsModule,
    ActiveAlertsComponent,
  ],
  templateUrl: './polygon-manager.html',
  styleUrl: './polygon-manager.scss',
})
export class PolygonManagerComponent implements MenuPanelComponent, OnDestroy {
  private readonly polygonService = inject(PolygonService);
  private readonly drawingService = inject(PolygonDrawingService);
  private readonly dialog = inject(MatDialog);

  readonly polygons = this.polygonService.allPolygons;
  readonly polygonCount = this.polygonService.polygonCount;
  readonly drawingMode = this.drawingService.drawingMode;
  readonly simplificationLevel = this.polygonService.simplificationLevel;

  editingNameId: string | null = null;

  onPanelOpen(): void {}

  ngOnDestroy(): void {
    this.drawingService.stopDrawing();
  }

  toggleDrawMode(): void {
    this.drawingService.toggleDrawMode(DrawingMode.DRAW);
  }

  isDrawing(): boolean {
    return this.drawingMode() === DrawingMode.DRAW;
  }

  isEditing(): boolean {
    return this.drawingMode() === DrawingMode.EDIT;
  }

  editPolygon(id: string): void {
    this.drawingService.startEditMode(id);
  }

  toggleVisibility(id: string): void {
    this.polygonService.toggleVisibility(id);
  }

  deletePolygon(id: string): void {
    const polygon = this.polygons().find((p) => p.id === id);
    const polygonName = polygon?.name || 'Sin nombre';

    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Eliminar polígono',
          message: `¿Está seguro que desea eliminar el polígono "${polygonName}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
          confirmColor: 'warn',
        },
      },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.polygonService.deletePolygon(id);
      }
    });
  }

  deleteAll(): void {
    const count = this.polygonCount();

    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Eliminar todos los polígonos',
          message: `¿Está seguro que desea eliminar todos los polígonos (${count})? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar todos',
          cancelText: 'Cancelar',
          confirmColor: 'warn',
        },
      },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.polygonService.deleteAll();
      }
    });
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

  onSimplificationChange(value: number): void {
    this.polygonService.setSimplificationLevel(value);
  }

  formatDate(date: Date): string {
    return formatDateTimeLocalized(new Date(date));
  }

  /**
   * Calcula el área aproximada de un polígono en km² usando la fórmula de Shoelace esférica
   */
  getPolygonArea(polygon: Polygon): number {
    const coords = polygon.coordinates;
    if (coords.length < 3) return 0;

    const R = 6371; // Radio de la Tierra en km
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      const lat1 = toRad(coords[i][0]);
      const lat2 = toRad(coords[j][0]);
      const lon1 = toRad(coords[i][1]);
      const lon2 = toRad(coords[j][1]);

      area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    area = (Math.abs(area) * R * R) / 2;
    return Math.round(area);
  }

  getCoordinatesCount(polygon: Polygon): number {
    return polygon.coordinates.length;
  }

  getDepartmentsCount(polygon: Polygon): number {
    return polygon.departments?.length || 0;
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

  hasAlerts(polygon: Polygon): boolean {
    return this.polygonService.hasAlerts(polygon.id);
  }

  isLoadingAlerts(polygon: Polygon): boolean {
    return this.polygonService.isAlertsLoading(polygon.id);
  }

  async generateAlerts(polygonId: string): Promise<void> {
    const dialogRef = this.dialog.open<PhenomenonSelectionDialogComponent, void, number | null>(
      PhenomenonSelectionDialogComponent,
      {
        width: '500px',
      },
    );

    const selectedCode = await firstValueFrom(dialogRef.afterClosed());

    if (selectedCode === null || selectedCode === undefined) {
      return;
    }

    const success = await this.polygonService.generateAlerts(polygonId, selectedCode);

    if (!success) {
      console.error('Error al generar alertas');
    }
  }

  onDepartmentHover(polygonId: string, departmentName: string): void {
    this.polygonService.setHoveredDepartment(polygonId, departmentName);
  }

  onDepartmentLeave(): void {
    this.polygonService.clearHoveredDepartment();
  }
}
