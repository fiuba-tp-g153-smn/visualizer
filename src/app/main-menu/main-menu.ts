import { Component, signal, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MainMenuButtonBar } from '../main-menu-button-bar/main-menu-button-bar';
import { LayerList } from '../layer-list/layer-list';
import { PolygonTool } from '../polygon-tool/polygon-tool';
import { TileConfig, type TileProvider } from '../tile-config/tile-config';

export type PanelType = 'layers' | 'polygons' | 'tiles' | null;

@Component({
  selector: 'app-main-menu',
  imports: [MainMenuButtonBar, LayerList, PolygonTool, TileConfig, MatIconModule, MatButtonModule],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenu {
  activePanel = signal<PanelType>(null);
  tileProviderChanged = output<TileProvider>();

  openPanel(panel: PanelType) {
    // Si el panel ya está activo, lo cerramos; si no, lo abrimos
    this.activePanel.set(this.activePanel() === panel ? null : panel);
  }

  closePanel() {
    this.activePanel.set(null);
  }

  getPanelTitle(): string {
    switch (this.activePanel()) {
      case 'layers':
        return 'Capas del mapa';
      case 'polygons':
        return 'Herramienta de polígonos';
      case 'tiles':
        return 'Mapa base';
      default:
        return '';
    }
  }

  onTileProviderChanged(provider: TileProvider): void {
    this.tileProviderChanged.emit(provider);
  }
}
