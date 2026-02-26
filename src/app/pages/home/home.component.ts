import { Component } from '@angular/core';
import { MapViewer } from '../../components/map-viewer/map-viewer';
import { MainMenuComponent } from '../../components/main-menu/main-menu';

@Component({
  selector: 'app-home',
  imports: [MapViewer, MainMenuComponent],
  template: `
    <app-map-viewer />
    <app-main-menu />
  `,
  styles: [],
})
export class HomeComponent {}
