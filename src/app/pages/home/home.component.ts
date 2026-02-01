import { Component } from '@angular/core';
import { MapViewer } from '../../components/map-viewer/map-viewer';
import { NotificationPanelComponent } from '../../components/notification-panel/notification-panel';
import { MainMenuComponent } from '../../components/main-menu/main-menu';

@Component({
  selector: 'app-home',
  imports: [MapViewer, NotificationPanelComponent, MainMenuComponent],
  template: `
    <app-map-viewer />
    <app-notification-panel />
    <app-main-menu />
  `,
  styles: [],
})
export class HomeComponent {}
