import { Component, input, output } from '@angular/core';
import { PolygonContextMenuComponent } from '../polygon-context-menu-ui/polygon-context-menu';
import { PolygonContextMenuAction } from '../../../models';
import { PolygonContextMenuState } from '../../../services/polygons/map-polygons.service';

@Component({
  selector: 'app-map-polygon-context-menu',
  standalone: true,
  imports: [PolygonContextMenuComponent],
  templateUrl: './polygon-context-menu.html',
  styleUrl: './polygon-context-menu.scss',
})
export class MapPolygonContextMenuComponent {
  readonly state = input<PolygonContextMenuState | null>(null);
  readonly action = output<PolygonContextMenuAction>();
  readonly close = output<void>();

  onBackdropClick(): void {
    this.close.emit();
  }

  onMenuClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  onAction(action: PolygonContextMenuAction): void {
    this.action.emit(action);
  }
}
