import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapViewer } from './map-viewer/map-viewer';
import { MainMenu } from './main-menu/main-menu';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MapViewer, MainMenu],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
