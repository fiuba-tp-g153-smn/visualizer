import { Component, EventEmitter, Output, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

export interface PolygonContextMenuAction {
  type:
    | 'edit'
    | 'visibility'
    | 'delete'
    | 'cut'
    | 'undoCut'
    | 'toggleDepartments'
    | 'hideDepartments';
  polygonId: string;
}

@Component({
  selector: 'app-polygon-context-menu',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatListModule],
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
  @Output() action = new EventEmitter<PolygonContextMenuAction>();

  onEdit(): void {
    this.action.emit({ type: 'edit', polygonId: this.polygonId });
  }

  onToggleVisibility(): void {
    this.action.emit({ type: 'visibility', polygonId: this.polygonId });
  }

  onDelete(): void {
    this.action.emit({ type: 'delete', polygonId: this.polygonId });
  }

  onCut(): void {
    this.action.emit({ type: 'cut', polygonId: this.polygonId });
  }

  onUndoCut(): void {
    this.action.emit({ type: 'undoCut', polygonId: this.polygonId });
  }

  onToggleDepartments(): void {
    this.action.emit({ type: 'toggleDepartments', polygonId: this.polygonId });
  }

  onHideDepartments(): void {
    this.action.emit({ type: 'hideDepartments', polygonId: this.polygonId });
  }
}
