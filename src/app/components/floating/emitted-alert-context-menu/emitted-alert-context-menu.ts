import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import {
  EmittedAlertContextMenuAction,
  EmittedAlertContextMenuActionType,
  EmittedAlertContextMenuState,
} from '../../../models';
import { DetailItemComponent } from '../../shared/detail-item/detail-item';
import {
  activeAlertColorForExpiry,
  formatActiveAlertRemaining,
} from '../../../utils/active-alert.utils';
import { darkenColor, lightenColor } from '../../../utils/map-styles.utils';
import { formatDateTimeLocalized } from '../../../utils/tileset-timestamp';

/**
 * Right-click menu for emitted (pending/active) alert polygons on the map.
 * Mirrors the floating backdrop + positioned `mat-nav-list` of the other map
 * context menus, with an info header reusing the ACP alert-card detail rows.
 * Emitted alerts are backend-owned, so there is no edit/delete.
 */
@Component({
  selector: 'app-emitted-alert-context-menu',
  standalone: true,
  imports: [MatIconModule, MatListModule, MatDividerModule, DetailItemComponent],
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

  formatDate(date: Date): string {
    return formatDateTimeLocalized(date);
  }

  remaining(endDatetime: Date): string {
    return formatActiveAlertRemaining(endDatetime);
  }

  expiryColor(endDatetime: Date): string {
    return activeAlertColorForExpiry(endDatetime);
  }

  expiryBackgroundColor(endDatetime: Date): string {
    return lightenColor(this.expiryColor(endDatetime), 55);
  }

  expiryTextColor(endDatetime: Date): string {
    return darkenColor(this.expiryColor(endDatetime), 35);
  }
}
