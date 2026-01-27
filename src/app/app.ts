import { Component } from '@angular/core';
import { MapViewer } from './components/map-viewer/map-viewer';
import { NotificationPanelComponent } from './components/notification-panel/notification-panel';
import { MainMenuComponent } from './components/main-menu/main-menu';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [MapViewer, NotificationPanelComponent, MainMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  ngOnInit() {
    console.log('Environment values:', environment);
  }
}
