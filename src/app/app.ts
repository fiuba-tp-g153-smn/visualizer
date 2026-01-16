import { Component, inject } from '@angular/core';
import { MapViewer } from './components/map-viewer/map-viewer';
import { TileService } from './services/tile.service';
import { LayerService } from './services/layer.service';
import { NotificationPanelComponent } from './components/notification-panel/notification-panel';
import { NotificationService } from './services/notification.service';
import { MainMenuComponent } from './components/main-menu/main-menu';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [MapViewer, NotificationPanelComponent, MainMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private tileService = inject(TileService);
  private layerService = inject(LayerService);
  private notificationService = inject(NotificationService);

  ngOnInit() {
    console.log('Environment values:', environment);
    // Exponer servicios en la consola para testing
    (window as any).tileService = this.tileService;
    (window as any).layerService = this.layerService;
    (window as any).notificationService = this.notificationService;
  }
}
