import { Component } from '@angular/core';
import { MapContainer } from '../../components/map-container/map-container';
import { MainMenuComponent } from '../../components/main-menu/main-menu';

@Component({
  selector: 'app-home',
  imports: [MapContainer, MainMenuComponent],
  template: `
    <app-map-container />
    <app-main-menu />
  `,
  styles: [],
})
export class HomeComponent {}
