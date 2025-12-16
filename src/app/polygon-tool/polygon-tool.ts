import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { Subject, takeUntil } from 'rxjs';
import { PolygonService, DrawnPolygon } from '../services/polygon.service';
import { UiService } from '../services/ui.service';

@Component({
  selector: 'app-polygon-tool',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatExpansionModule,
    MatSliderModule,
  ],
  templateUrl: './polygon-tool.html',
  styleUrl: './polygon-tool.scss',
})
export class PolygonTool implements OnInit, OnDestroy {
  private polygonService = inject(PolygonService);
  private uiService = inject(UiService);
  private destroy$ = new Subject<void>();

  @ViewChildren(MatExpansionPanel) expansionPanels!: QueryList<MatExpansionPanel>;

  // Colores disponibles para polígonos
  availableColors = [
    '#1191D0',
    '#FCB426',
    '#1D1D1E',
    '#4bb0e0',
    '#fdc94d',
    '#e74c3c',
    '#2ecc71',
    '#9b59b6',
  ];

  // Estado desde el servicio
  isDrawing = this.polygonService.isDrawing;
  editingPolygonId = this.polygonService.editingPolygonId;
  polygons = this.polygonService.polygons;
  selectedPolygonId = this.uiService.selectedPolygonId;

  // Estado local para renombrar
  editingNameId = signal<string | null>(null);
  tempName = signal<string>('');

  ngOnInit(): void {
    // Escuchar selección de polígono desde el mapa
    this.uiService
      .onOpenPolygonPanel()
      .pipe(takeUntil(this.destroy$))
      .subscribe((polygonId) => {
        console.log('📍 Opening polygon panel for:', polygonId);
        setTimeout(() => this.expandPolygonPanel(polygonId), 100);
      });

    // Escuchar cierre del panel para finalizar acciones en curso
    this.uiService
      .onPanelClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((panelType) => {
        console.log('🚪 Panel closed event received:', panelType);
        if (panelType === 'polygons') {
          console.log('🔧 Finalizing polygon actions...');
          this.finalizeAllActions();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private expandPolygonPanel(polygonId: string): void {
    const polygonsList = this.polygons();
    const index = polygonsList.findIndex((p) => p.id === polygonId);
    if (index !== -1 && this.expansionPanels) {
      const panels = this.expansionPanels.toArray();
      if (panels[index]) {
        panels[index].open();
      }
    }
  }

  private finalizeAllActions(): void {
    console.log('🔧 finalizeAllActions called', {
      isDrawing: this.isDrawing(),
      editingPolygonId: this.editingPolygonId(),
      editingNameId: this.editingNameId(),
    });

    // Cancelar dibujo si está activo
    if (this.isDrawing()) {
      console.log('  - Stopping drawing');
      this.polygonService.stopDrawing();
    }

    // Guardar edición de puntos si está activa
    if (this.editingPolygonId()) {
      console.log('  - Stopping editing');
      this.polygonService.stopEditing();
    }

    // Cancelar renombrado si está activo
    if (this.editingNameId()) {
      console.log('  - Canceling rename');
      this.cancelRename();
    }
  }

  startDrawing(): void {
    this.polygonService.startDrawing();
  }

  stopDrawing(): void {
    this.polygonService.stopDrawing();
  }

  // Cambiar color
  changeColor(polygonId: string, color: string): void {
    this.polygonService.changeColor(polygonId, color);
  }

  // Visibilidad
  toggleVisibility(polygonId: string): void {
    this.polygonService.toggleVisibility(polygonId);
  }

  // Opacidad
  changeOpacity(polygonId: string, opacity: number): void {
    this.polygonService.changeOpacity(polygonId, opacity);
  }

  // Editar puntos
  startEditPoints(polygonId: string): void {
    this.polygonService.startEditing(polygonId);
  }

  stopEditPoints(): void {
    this.polygonService.stopEditing();
  }

  isEditingPoints(polygonId: string): boolean {
    return this.editingPolygonId() === polygonId;
  }

  // Renombrar
  startRename(polygon: DrawnPolygon): void {
    this.editingNameId.set(polygon.id);
    this.tempName.set(polygon.name);
  }

  saveRename(polygonId: string): void {
    const name = this.tempName().trim();
    if (name) {
      this.polygonService.renamePolygon(polygonId, name);
    }
    this.cancelRename();
  }

  cancelRename(): void {
    this.editingNameId.set(null);
    this.tempName.set('');
  }

  onRenameKey(event: KeyboardEvent, polygonId: string): void {
    if (event.key === 'Enter') this.saveRename(polygonId);
    if (event.key === 'Escape') this.cancelRename();
  }

  // Acciones
  zoomTo(polygonId: string): void {
    this.polygonService.zoomTo(polygonId);
  }

  delete(polygonId: string): void {
    this.polygonService.deletePolygon(polygonId);
  }

  moveUp(polygonId: string): void {
    this.polygonService.movePolygon(polygonId, 'up');
  }

  moveDown(polygonId: string): void {
    this.polygonService.movePolygon(polygonId, 'down');
  }

  isFirst(polygonId: string): boolean {
    const list = this.polygons();
    return list.length > 0 && list[0].id === polygonId;
  }

  isLast(polygonId: string): boolean {
    const list = this.polygons();
    return list.length > 0 && list[list.length - 1].id === polygonId;
  }

  clearAll(): void {
    if (confirm('¿Eliminar todos los polígonos?')) {
      this.polygonService.clearAllPolygons();
    }
  }

  export(): void {
    this.polygonService.downloadGeoJSON();
  }

  // Utilidades
  formatArea(area?: number): string {
    if (!area) return 'N/A';
    if (area > 10000) return `${(area / 1000000).toFixed(2)} km²`;
    return `${Math.round(area)} m²`;
  }
}
