import { Component } from '@angular/core';
import { MapContainer } from '../../components/map-container/map-container';
import { MapOverlayComponent } from '../../components/overlay/map-overlay';

@Component({
  selector: 'app-home',
  imports: [MapContainer, MapOverlayComponent],
  template: `
    <app-map-container />
    <app-map-overlay />
  `,
  styles: [
    `
      :host {
        display: grid;
        width: 100vw;
        height: 100vh;
      }
      :host > * {
        grid-area: 1 / 1;
      }
    `,
  ],
})
export class HomeComponent {}
