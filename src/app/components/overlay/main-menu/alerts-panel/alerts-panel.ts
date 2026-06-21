import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { PolygonService } from '../../../../services/polygons/polygon.service';
import { AlertEmissionService } from '../../../../services/polygons/alert-emission.service';
import {
  DrawingMode,
  PolygonDrawingService,
} from '../../../../services/polygons/polygon-drawing.service';
import { Polygon, DepartmentRef } from '../../../../models/geo';
import { MenuPanelComponent } from '../menu-section.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../floating/confirm-dialog/confirm-dialog';
import { formatDateTimeLocalized } from '../../../../utils/tileset-timestamp';
import { formatWithThousandsSeparator } from '../../../../utils/number-format.utils';
import { EmittedAlertsComponent } from './emitted-alerts/emitted-alerts';
import { DepartmentListComponent } from './department-list/department-list';
import { AlertListItemComponent } from './alert-list-item/alert-list-item';
import { AlertsPanelStateService } from './alerts-panel-state.service';
import { DetailItemComponent } from '../../../shared/detail-item/detail-item';
import { DetailChipComponent } from '../../../shared/detail-chip/detail-chip';
import { DetailRowConfig } from './alert-list-item/alert-list-item';
import { MapInfoService } from '../../../../services/layers/map-info.service';

@Component({
  selector: 'app-alerts-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatSliderModule,
    MatTabsModule,
    EmittedAlertsComponent,
    DepartmentListComponent,
    AlertListItemComponent,
    DetailItemComponent,
    DetailChipComponent,
  ],
  templateUrl: './alerts-panel.html',
  styleUrl: './alerts-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPanelComponent implements MenuPanelComponent {
  private readonly polygonService = inject(PolygonService);
  private readonly alertEmissionService = inject(AlertEmissionService);
  private readonly panelState = inject(AlertsPanelStateService);
  private readonly drawingService = inject(PolygonDrawingService);
  private readonly dialog = inject(MatDialog);
  private readonly mapInfoService = inject(MapInfoService);

  readonly polygons = this.polygonService.allPolygons;
  readonly polygonCount = this.polygonService.polygonCount;
  readonly drawingMode = this.drawingService.drawingMode;
  readonly detailLevel = this.polygonService.detailLevel;

  readonly selectedTabIndex = this.panelState.selectedTabIndex;
  readonly maxVertices = this.polygonService.maxVertices;

  onPanelOpen(): void {}

  flyToPolygon(polygon: Polygon): void {
    this.mapInfoService.flyToCoordinates(polygon.coordinates);
  }

  onTabIndexChange(index: number): void {
    this.selectedTabIndex.set(index);
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

  onDetailLevelChange(value: number): void {
    this.polygonService.setDetailLevel(value);
  }

  formatDate(date: Date): string {
    return formatDateTimeLocalized(new Date(date));
  }

  getPolygonArea(polygon: Polygon): string {
    const coords = polygon.coordinates;
    if (coords.length < 3) return formatWithThousandsSeparator(0);

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
    return formatWithThousandsSeparator(Math.round(area));
  }

  getCoordinatesCount(polygon: Polygon): number {
    return polygon.coordinates.length;
  }

  getDetailRows(polygon: Polygon): DetailRowConfig[] {
    const exceedsMax = this.exceedsMaxVertices(polygon);

    return [
      {
        icon: 'timeline',
        label: 'Vértices:',
        value: String(this.getCoordinatesCount(polygon)),
        dividerBefore: true,
        warn: exceedsMax,
        tooltip: exceedsMax
          ? `Supera el máximo de ${this.maxVertices()} vértices. Simplificá el polígono para poder generar el aviso.`
          : undefined,
      },
      { icon: 'square_foot', label: 'Área:', value: `${this.getPolygonArea(polygon)} km²` },
      { icon: 'schedule', label: 'Modificado:', value: this.formatDate(polygon.updatedAt) },
    ];
  }

  exceedsMaxVertices(polygon: Polygon): boolean {
    return this.polygonService.exceedsMaxVertices(polygon);
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

  isLoadingAlerts(polygon: Polygon): boolean {
    return this.polygonService.isAlertsLoading(polygon.id);
  }

  async generateAlerts(polygonId: string): Promise<void> {
    await this.alertEmissionService.emitAlert(polygonId);
  }

  onDepartmentHover(polygonId: string, department: DepartmentRef): void {
    this.polygonService.setHoveredDepartment(polygonId, department);
  }

  onProvinceHover(polygonId: string, departments: ReadonlyArray<DepartmentRef>): void {
    this.polygonService.setHoveredDepartments(polygonId, departments);
  }

  onDepartmentLeave(): void {
    this.polygonService.clearHoveredDepartment();
  }
}
