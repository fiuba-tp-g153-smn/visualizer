import { Component, signal } from '@angular/core';
import { MapViewer } from './map-viewer/map-viewer';

@Component({
  selector: 'app-root',
  imports: [MapViewer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('visualizator-clean');
}
