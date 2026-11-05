import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import {
  MapContextMenuItem,
  MapContextMenuState,
} from '../../../services/map-context-menu/map-context-menu.models';
import { ContextMenuPositionDirective } from '../../shared/context-menu-position/context-menu-position.directive';
import { MAP_TEXTS } from '../../../texts';

/**
 * Right-click menu over empty map. Renders the sections features contribute through
 * `MapContextMenuService`. Mirrors `SearchResultContextMenuComponent`'s floating
 * backdrop + positioned `mat-nav-list` so all map context menus share the same look.
 */
@Component({
  selector: 'app-map-context-menu',
  standalone: true,
  imports: [
    A11yModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    ContextMenuPositionDirective,
  ],
  templateUrl: './map-context-menu.html',
  styleUrl: './map-context-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapContextMenuComponent {
  protected readonly t = MAP_TEXTS.contextMenu;
  readonly state = input<MapContextMenuState | null>(null);
  readonly select = output<MapContextMenuItem>();
  readonly close = output<void>();

  onBackdropClick(): void {
    this.close.emit();
  }

  onMenuClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
