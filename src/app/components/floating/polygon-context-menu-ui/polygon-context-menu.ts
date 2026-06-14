import { Component, EventEmitter, Output, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  PolygonContextMenuAction,
  PolygonContextMenuActionType,
} from '../../../models/polygon-context-menu-action.model';

@Component({
  selector: 'app-polygon-context-menu',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatListModule, MatTooltipModule],
  templateUrl: './polygon-context-menu.html',
  styleUrl: './polygon-context-menu.scss',
})
export class PolygonContextMenuComponent {
  @Input() polygonId!: string;
  @Input() polygonVisible: boolean = true;
  @Input() hasDepartments: boolean = false;
  @Input() departmentsVisible: boolean = false;
  @Input() canUndoCut: boolean = false;
  @Input() isLoadingCut: boolean = false;
  @Input() isLoadingDepartments: boolean = false;
  @Input() isLoadingAlerts: boolean = false;
  @Input() exceedsMaxVertices: boolean = false;
  @Input() maxVertices: number = 0;
  @Output() action = new EventEmitter<PolygonContextMenuAction>();

  onEdit(): void {
    this.action.emit({ type: PolygonContextMenuActionType.EDIT, polygonId: this.polygonId });
  }

  onToggleVisibility(): void {
    this.action.emit({
      type: PolygonContextMenuActionType.VISIBILITY,
      polygonId: this.polygonId,
    });
  }

  onDelete(): void {
    this.action.emit({ type: PolygonContextMenuActionType.DELETE, polygonId: this.polygonId });
  }

  onCut(): void {
    this.action.emit({ type: PolygonContextMenuActionType.CUT, polygonId: this.polygonId });
  }

  onUndoCut(): void {
    this.action.emit({ type: PolygonContextMenuActionType.UNDO_CUT, polygonId: this.polygonId });
  }

  onToggleDepartments(): void {
    this.action.emit({
      type: PolygonContextMenuActionType.TOGGLE_DEPARTMENTS,
      polygonId: this.polygonId,
    });
  }

  onHideDepartments(): void {
    this.action.emit({
      type: PolygonContextMenuActionType.HIDE_DEPARTMENTS,
      polygonId: this.polygonId,
    });
  }

  onGenerateAlert(): void {
    this.action.emit({
      type: PolygonContextMenuActionType.GENERATE_ALERT,
      polygonId: this.polygonId,
    });
  }
}
