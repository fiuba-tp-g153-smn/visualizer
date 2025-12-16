import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MainMenuButtonBar } from '../main-menu-button-bar/main-menu-button-bar';
import { LayerList } from '../layer-list/layer-list';
import { PolygonTool } from '../polygon-tool/polygon-tool';
import { TileConfig, type TileProvider } from '../tile-config/tile-config';
import { UiService, type PanelType } from '../services/ui.service';

@Component({
  selector: 'app-main-menu',
  imports: [MainMenuButtonBar, LayerList, PolygonTool, TileConfig, MatIconModule, MatButtonModule],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenu {
  private uiService = inject(UiService);

  activePanel = this.uiService.activePanel;
  tileProviderChanged = output<TileProvider>();

  openPanel(panel: PanelType) {
    this.uiService.togglePanel(panel);
  }

  closePanel() {
    this.uiService.closePanel();
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
