import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import {
  EmittedAlertContextMenuAction,
  EmittedAlertContextMenuActionType,
  EmittedAlertContextMenuState,
} from '../../../models';

/**
 * Right-click menu for emitted (pending/active) alert polygons on the map.
 * Mirrors the floating backdrop + positioned `mat-nav-list` of the other map
 * context menus. Emitted alerts are backend-owned, so there is no edit/delete.
 */
@Component({
  selector: 'app-emitted-alert-context-menu',
  standalone: true,
  imports: [MatIconModule, MatListModule],
  templateUrl: './emitted-alert-context-menu.html',
  styleUrl: './emitted-alert-context-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmittedAlertContextMenuComponent {
  readonly state = input<EmittedAlertContextMenuState | null>(null);
  readonly action = output<EmittedAlertContextMenuAction>();
  readonly close = output<void>();

  onBackdropClick(): void {
    this.close.emit();
  }

  onMenuClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  emit(type: EmittedAlertContextMenuActionType): void {
    const state = this.state();
    if (!state) return;
    this.action.emit({ type, kind: state.kind, alertId: state.alertId });
  }
}
