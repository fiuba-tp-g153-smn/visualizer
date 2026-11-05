import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { ContextMenuPositionDirective } from '../../shared/context-menu-position/context-menu-position.directive';
import { MAP_TEXTS } from '../../../texts';

/** Screen position (in map-container pixels) where the context menu should open. */
export interface SearchResultContextMenuState {
  readonly x: number;
  readonly y: number;
}

/**
 * Right-click menu for the place-search marker/polygon shown on the map.
 * Mirrors `MapPolygonContextMenuComponent`'s floating backdrop + positioned
 * `mat-nav-list` so all map context menus share the same look and feel.
 */
@Component({
  selector: 'app-search-result-context-menu',
  standalone: true,
  imports: [MatIconModule, MatListModule, ContextMenuPositionDirective],
  templateUrl: './search-result-context-menu.html',
  styleUrl: './search-result-context-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultContextMenuComponent {
  protected readonly t = MAP_TEXTS.searchResultMenu;
  readonly state = input<SearchResultContextMenuState | null>(null);
  readonly clear = output<void>();
  readonly close = output<void>();

  onBackdropClick(): void {
    this.close.emit();
  }

  onMenuClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  onClear(): void {
    this.clear.emit();
    this.close.emit();
  }
}
