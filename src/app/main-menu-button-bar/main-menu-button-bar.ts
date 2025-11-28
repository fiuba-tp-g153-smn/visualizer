import { Component, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MenuButton } from '../menu-button/menu-button';

@Component({
  selector: 'app-main-menu-button-bar',
  templateUrl: 'main-menu-button-bar.html',
  styleUrl: 'main-menu-button-bar.scss',
  imports: [MatCardModule, MenuButton],
})
export class MainMenuButtonBar {
  layersClick = output<void>();
  polygonsClick = output<void>();
  tilesClick = output<void>();
}
