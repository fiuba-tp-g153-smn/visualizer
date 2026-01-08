import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TileService } from '../../services/tile.service';

/**
 * Menú principal con controles del mapa
 */
@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenuComponent {
  readonly tileService = inject(TileService);

  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }
}
