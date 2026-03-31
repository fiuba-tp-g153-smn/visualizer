import { Component, input, output } from '@angular/core';
import {
  PolygonEditAction,
  PolygonEditControlsComponent,
} from '../polygon-edit-controls/polygon-edit-controls';

@Component({
  selector: 'app-map-edit-controls',
  standalone: true,
  imports: [PolygonEditControlsComponent],
  templateUrl: './edit-controls.html',
  styleUrl: './edit-controls.scss',
})
export class MapEditControlsComponent {
  readonly visible = input<boolean>(false);
  readonly action = output<PolygonEditAction>();

  onAction(action: PolygonEditAction): void {
    this.action.emit(action);
  }
}
