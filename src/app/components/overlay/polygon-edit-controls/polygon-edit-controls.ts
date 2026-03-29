import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface PolygonEditAction {
  type: 'save' | 'cancel';
}

@Component({
  selector: 'app-polygon-edit-controls',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './polygon-edit-controls.html',
  styleUrl: './polygon-edit-controls.scss',
})
export class PolygonEditControlsComponent {
  @Output() action = new EventEmitter<PolygonEditAction>();

  onSave(): void {
    this.action.emit({ type: 'save' });
  }

  onCancel(): void {
    this.action.emit({ type: 'cancel' });
  }
}
