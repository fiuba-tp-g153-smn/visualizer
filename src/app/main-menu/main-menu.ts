import { Component, signal } from '@angular/core';
import { MainMenuButtonBar } from '../main-menu-button-bar/main-menu-button-bar';
import { LayerList } from '../layer-list/layer-list';

@Component({
  selector: 'app-main-menu',
  imports: [MainMenuButtonBar, LayerList],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss'
})
export class MainMenu {
  isLayerListVisible = signal(false);

  toggleLayerList() {
    this.isLayerListVisible.set(!this.isLayerListVisible());
  }

  closeLayerList() {
    this.isLayerListVisible.set(false);
  }
}
