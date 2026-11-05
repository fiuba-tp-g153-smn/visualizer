import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { COMMON_TEXTS } from '../../../texts';

export interface PolygonEditAction {
  type: 'save' | 'cancel';
}

@Component({
  selector: 'app-polygon-edit-dock',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './polygon-edit-dock.html',
  styleUrl: './polygon-edit-dock.scss',
})
export class PolygonEditDockComponent {
  protected readonly common = COMMON_TEXTS.actions;
  @Output() action = new EventEmitter<PolygonEditAction>();

  onSave(): void {
    this.action.emit({ type: 'save' });
  }

  onCancel(): void {
    this.action.emit({ type: 'cancel' });
  }
}
