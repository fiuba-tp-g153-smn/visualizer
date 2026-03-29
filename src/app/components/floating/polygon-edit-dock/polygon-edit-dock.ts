import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

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
  @Output() action = new EventEmitter<PolygonEditAction>();

  onSave(): void {
    this.action.emit({ type: 'save' });
  }

  onCancel(): void {
    this.action.emit({ type: 'cancel' });
  }
}
